"use server";

/**
 * Community questions (migration 020).
 *
 * Unlike the library modules, this data is public: questions and answers are
 * meant to be read by the whole community, and RLS reflects that with
 * `USING (true)` SELECT policies on both tables. The protection here is on the
 * write side, in two layers:
 *
 *   1. Every write resolves the caller with getCurrentUser() and attributes the
 *      row to that id.
 *   2. RLS requires user_id = auth.uid() AND that the question's
 *      [start_date, end_date) window contains NOW(), so an answer cannot be
 *      posted to a closed question through any client.
 *
 * The window check is duplicated in `getCurrentQuestion` and in the policy on
 * purpose: the read gives a clean 409 with a useful message, and the policy is
 * the guarantee that holds even if a handler forgets.
 */

import { createClient } from "@/utils/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import type {
  ActionResult,
  CurrentQuestionSummary,
  DBCommunityQuestion,
  DBQuestionResponse,
  SubmitResponseResult,
} from "@/types/database";
import { RESPONSE_TEXT_MAX_LENGTH } from "@/types/database";

/**
 * The question whose active window contains now, or null between questions.
 *
 * Ordered by start_date DESC and limited to one so that overlapping windows —
 * which the schema permits, since a range-exclusion constraint would block an
 * admin from fixing a typo by scheduling a replacement — resolve deterministically
 * to the most recently started question rather than an arbitrary row.
 */
async function fetchCurrentQuestionRow(): Promise<
  { data: DBCommunityQuestion | null } | { error: string }
> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("community_questions")
    .select("*")
    .lte("start_date", nowIso)
    .gt("end_date", nowIso)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  return { data: (data as DBCommunityQuestion | null) ?? null };
}

/**
 * The current question, how many people have answered, and the caller's own
 * answer if they have one.
 *
 * A null question is a normal state, not an error: there may simply be nothing
 * scheduled right now. Callers get `response_count: 0` alongside it rather than
 * having to special-case the shape.
 */
export async function getCurrentQuestion(): Promise<
  ActionResult<CurrentQuestionSummary>
> {
  try {
    const current = await fetchCurrentQuestionRow();
    if ("error" in current) {
      return { error: current.error };
    }

    const question = current.data;
    if (!question) {
      return { data: { question: null, response_count: 0, user_response: null } };
    }

    const supabase = await createClient();

    // head: true with an exact count returns the number without transferring a
    // single row — the count is all a client needs, and shipping every answer
    // to compute it would grow linearly with participation.
    const { count, error: countError } = await supabase
      .from("question_responses")
      .select("id", { count: "exact", head: true })
      .eq("question_id", question.id);

    if (countError) {
      return { error: countError.message };
    }

    // The caller's own answer, so a UI can render the form pre-filled in "edit"
    // mode rather than inviting a duplicate that the unique index would reject.
    let userResponse: DBQuestionResponse | null = null;
    const user = await getCurrentUser();
    if (user) {
      const { data: mine, error: mineError } = await supabase
        .from("question_responses")
        .select("*")
        .eq("question_id", question.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (mineError) {
        return { error: mineError.message };
      }
      userResponse = (mine as DBQuestionResponse | null) ?? null;
    }

    return {
      data: {
        question,
        response_count: count ?? 0,
        user_response: userResponse,
      },
    };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Failed to fetch current question",
    };
  }
}

/**
 * Submit the current user's answer to a question.
 *
 * Idempotent in the same sense as saveItem: answering twice edits the existing
 * answer rather than erroring, because "my answer to this question is X" is a
 * desired end state and the unique index forbids a second row anyway.
 * `created` reports which way it went.
 *
 * `closed` is returned separately from a generic error so the route can map it
 * to 409 — the request was well-formed and the user was allowed to make it, the
 * question just is not open any more.
 */
export async function submitQuestionResponse(
  questionId: string,
  responseText: string
): Promise<
  ActionResult<SubmitResponseResult> & { notFound?: boolean; closed?: boolean }
> {
  const trimmed = typeof responseText === "string" ? responseText.trim() : "";

  if (!trimmed) {
    return { error: "Response text is required" };
  }
  if (trimmed.length > RESPONSE_TEXT_MAX_LENGTH) {
    return {
      error: `Response must be ${RESPONSE_TEXT_MAX_LENGTH} characters or fewer`,
    };
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Not authenticated" };
    }

    const supabase = await createClient();

    // Load the target question so a missing one reads as 404 and a closed one
    // as 409, rather than both surfacing as an opaque RLS policy violation on
    // the write below.
    const { data: question, error: questionError } = await supabase
      .from("community_questions")
      .select("id, start_date, end_date")
      .eq("id", questionId)
      .maybeSingle();

    if (questionError) {
      return { error: questionError.message };
    }
    if (!question) {
      return { error: "Question not found", notFound: true };
    }

    const row = question as Pick<
      DBCommunityQuestion,
      "id" | "start_date" | "end_date"
    >;
    const now = Date.now();
    const start = new Date(row.start_date).getTime();
    const end = new Date(row.end_date).getTime();

    // An unparseable stored bound (NaN) fails this check and is reported as
    // closed. That is the safe direction: the RLS policy would reject the write
    // anyway, so a clear 409 beats a 500 from the database.
    if (!(now >= start && now < end)) {
      return {
        error: "This question is not currently accepting responses",
        closed: true,
      };
    }

    // Was this their first answer? Checked explicitly rather than inferred from
    // timestamps: the BEFORE UPDATE trigger bumps updated_at even when nothing
    // changes, so created_at === updated_at is not a reliable "new row" signal.
    const { data: existing, error: existingError } = await supabase
      .from("question_responses")
      .select("id")
      .eq("question_id", questionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) {
      return { error: existingError.message };
    }

    // Upsert on (question_id, user_id): re-answering edits in place, and the
    // conflict target absorbs the race where a double-submit arrives twice.
    const { data, error } = await supabase
      .from("question_responses")
      .upsert(
        {
          question_id: questionId,
          user_id: user.id,
          response_text: trimmed,
        },
        { onConflict: "question_id,user_id", ignoreDuplicates: false }
      )
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    return {
      data: { response: data as DBQuestionResponse, created: !existing },
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to submit response",
    };
  }
}
