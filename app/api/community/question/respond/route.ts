/**
 * POST /api/community/question/respond — submit an answer to a question.
 *
 * Body: { "question_id": "<uuid>", "response_text": "..." }
 *
 * `question_id` is required rather than inferred from "whatever is current".
 * A member can spend minutes writing an answer, and if the question rolls over
 * mid-compose an inferred id would silently file that answer under the new
 * prompt. An explicit id turns that race into an honest 409.
 *
 * Idempotent: answering twice edits the existing answer instead of creating a
 * second one. 201 on a first answer, 200 on an edit.
 *
 * Auth: requires a session. Note that proxy.ts only guards /admin and
 * /api/admin, so this route checks for itself; RLS is the backstop and
 * additionally enforces the open-window rule.
 */

import { NextRequest, NextResponse } from "next/server";
import { submitQuestionResponse } from "@/lib/actions/community";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/actions/libraryValidation";
import { checkLimit } from "@/lib/chat/rateLimit";
import { RESPONSE_TEXT_MAX_LENGTH } from "@/types/database";

export const dynamic = "force-dynamic";

/**
 * Answers are public and cheap to write, so the bucket is generous — it exists
 * to stop a stuck client or a script hammering the table, not to ration normal
 * use. A member editing their answer a few times is expected.
 */
const RESPOND_RATE_LIMIT = { max: 30, windowMs: 10 * 60 * 1000 } as const;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to respond" },
      { status: 401 }
    );
  }

  const limit = checkLimit(`question-respond:${user.id}`, RESPOND_RATE_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSec: limit.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  let body: { question_id?: unknown; response_text?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isUuid(body.question_id)) {
    return NextResponse.json(
      { error: "question_id is required and must be a UUID" },
      { status: 400 }
    );
  }

  if (typeof body.response_text !== "string") {
    return NextResponse.json(
      { error: "response_text is required and must be a string" },
      { status: 400 }
    );
  }
  if (!body.response_text.trim()) {
    return NextResponse.json(
      { error: "response_text cannot be blank" },
      { status: 400 }
    );
  }
  if (body.response_text.trim().length > RESPONSE_TEXT_MAX_LENGTH) {
    return NextResponse.json(
      {
        error: `response_text must be ${RESPONSE_TEXT_MAX_LENGTH} characters or fewer`,
      },
      { status: 400 }
    );
  }

  const result = await submitQuestionResponse(
    body.question_id,
    body.response_text
  );

  if (result.error || !result.data) {
    if (result.notFound) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    // 409: the request was valid and the user was allowed to make it — the
    // question simply is not open. Distinct from a 400, because nothing about
    // the payload needs fixing.
    if (result.closed) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }
    console.error("[Community API] respond failed:", result.error);
    return NextResponse.json(
      { error: result.error ?? "Failed to submit response" },
      { status: 500 }
    );
  }

  const created = result.data.created;

  return NextResponse.json(
    { response: result.data.response, created },
    { status: created ? 201 : 200 }
  );
}
