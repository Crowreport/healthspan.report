-- Week 6: community question of the week.
--
-- Two tables:
--   public.community_questions  — an admin-authored prompt with an active window
--   public.question_responses   — one member's answer to one question
--
-- SHAPE DECISION: the "current" question is derived from the clock, not from a
-- boolean flag. A question is current when NOW() falls inside
-- [start_date, end_date). An `is_active` column was rejected because it needs a
-- writer to flip it — a cron, an admin remembering, or a bug — and the moment
-- that writer fails the site shows a stale question. A time window is correct
-- with no moving parts, and it lets an admin schedule next week's question
-- today.
--
-- end_date is EXCLUSIVE. A question ending 2026-09-15T00:00Z stops being
-- current the instant that timestamp arrives, so consecutive questions can be
-- scheduled back-to-back with identical boundary timestamps and never overlap.
--
-- Idempotent throughout: CREATE ... IF NOT EXISTS and DROP POLICY IF EXISTS
-- before each CREATE POLICY, matching migrations 016-019.

-- ---------------------------------------------------------------------------
-- 1. Community questions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.community_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The prompt itself, as shown to members.
  question_text TEXT NOT NULL,
  -- Optional framing shown under the prompt: context, an example answer, a
  -- source link. Nullable because most questions need no elaboration.
  description TEXT,
  -- Active window. start_date is inclusive, end_date exclusive.
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.community_questions IS
  'Admin-authored community prompts. The current question is the one whose [start_date, end_date) window contains NOW() — there is no is_active flag to keep in sync.';
COMMENT ON COLUMN public.community_questions.end_date IS
  'Exclusive upper bound. A question stops being current the instant this timestamp arrives, so back-to-back questions may share a boundary without overlapping.';

-- A blank prompt would render as an empty card. Rejected at the database level
-- so no writer — route, admin tool, or SQL console — can create one.
ALTER TABLE public.community_questions
  DROP CONSTRAINT IF EXISTS community_questions_text_not_blank;
ALTER TABLE public.community_questions
  ADD CONSTRAINT community_questions_text_not_blank
  CHECK (length(btrim(question_text)) > 0);

-- A window that ends before it starts can never be current, so it is a silent
-- authoring mistake — one that would leave the site with no question at all.
ALTER TABLE public.community_questions
  DROP CONSTRAINT IF EXISTS community_questions_window_valid;
ALTER TABLE public.community_questions
  ADD CONSTRAINT community_questions_window_valid
  CHECK (end_date > start_date);

-- The hot read: "which question is current?" — a range scan on start_date with
-- end_date available for the second half of the predicate.
CREATE INDEX IF NOT EXISTS community_questions_window_idx
  ON public.community_questions (start_date DESC, end_date DESC);

DROP TRIGGER IF EXISTS update_community_questions_updated_at ON public.community_questions;
CREATE TRIGGER update_community_questions_updated_at
  BEFORE UPDATE ON public.community_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.community_questions ENABLE ROW LEVEL SECURITY;

-- Questions are public, like reaction counts (migration 016) and unlike the
-- library (018/019). Anonymous visitors see the prompt; only signing in lets
-- them answer.
--
-- NOTE: this exposes scheduled future questions and expired past ones to
-- anyone who queries the table directly. That is acceptable — a discussion
-- prompt is not a secret — and the API layer narrows reads to the current
-- window anyway.
DROP POLICY IF EXISTS "Community questions are viewable by everyone" ON public.community_questions;
CREATE POLICY "Community questions are viewable by everyone"
  ON public.community_questions
  FOR SELECT
  USING (true);

-- Authoring is admin-only and deliberately has no INSERT/UPDATE/DELETE policy
-- for ordinary members: questions are created through the Supabase dashboard or
-- a service-role admin tool, both of which bypass RLS. Adding a member-facing
-- write policy here would let any signed-in user post a question to the whole
-- community.

-- ---------------------------------------------------------------------------
-- 2. Question responses
-- ---------------------------------------------------------------------------

-- CARDINALITY DECISION: one row per (question_id, user_id).
--
-- A member gets one answer per question, enforced by the unique index below.
-- Threaded multi-answer discussion already exists as public.comments
-- (migration 012); this is the lighter "everyone answers the same prompt"
-- format, and one-answer-each is what keeps it readable and what makes the
-- response count meaningful as a participation number.
--
-- Editing an answer is an UPDATE of the existing row rather than a second
-- insert, which is why an UPDATE policy exists here but not on item_reactions.
CREATE TABLE IF NOT EXISTS public.question_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL
    REFERENCES public.community_questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  response_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.question_responses IS
  'Member answers to a community question. One row per (question_id, user_id): answering again edits the existing answer rather than adding a second one.';

-- Blank answers are not participation. Checked here as well as in the API so a
-- whitespace-only string cannot reach the table by any path.
ALTER TABLE public.question_responses
  DROP CONSTRAINT IF EXISTS question_responses_text_not_blank;
ALTER TABLE public.question_responses
  ADD CONSTRAINT question_responses_text_not_blank
  CHECK (length(btrim(response_text)) > 0);

-- Bound the length in the database as well as the route. Without this a single
-- request could store an unbounded blob, and every reader of the thread would
-- pay for it.
ALTER TABLE public.question_responses
  DROP CONSTRAINT IF EXISTS question_responses_text_max_length;
ALTER TABLE public.question_responses
  ADD CONSTRAINT question_responses_text_max_length
  CHECK (length(response_text) <= 2000);

-- One answer per member per question — also the upsert conflict target.
CREATE UNIQUE INDEX IF NOT EXISTS question_responses_question_user_unique_idx
  ON public.question_responses (question_id, user_id);

-- "Show this question's answers, newest first" and the response count both run
-- off this index.
CREATE INDEX IF NOT EXISTS question_responses_question_created_idx
  ON public.question_responses (question_id, created_at DESC);

-- "What has this member answered" — for a profile or activity view.
CREATE INDEX IF NOT EXISTS question_responses_user_id_idx
  ON public.question_responses (user_id);

DROP TRIGGER IF EXISTS update_question_responses_updated_at ON public.question_responses;
CREATE TRIGGER update_question_responses_updated_at
  BEFORE UPDATE ON public.question_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.question_responses ENABLE ROW LEVEL SECURITY;

-- Answers are public: the point of the feature is that the community reads
-- each other's replies. This is the opposite of saved_items/reading_history,
-- where the whole table is owner-only.
DROP POLICY IF EXISTS "Question responses are viewable by everyone" ON public.question_responses;
CREATE POLICY "Question responses are viewable by everyone"
  ON public.question_responses
  FOR SELECT
  USING (true);

-- A member may only post an answer attributed to themselves, and only to a
-- question that is currently open. The window check lives in the policy rather
-- than only in the route so a closed question cannot be answered through any
-- client — including a direct PostgREST call with a valid user token.
DROP POLICY IF EXISTS "Users can create their own question responses" ON public.question_responses;
CREATE POLICY "Users can create their own question responses"
  ON public.question_responses
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.community_questions q
      WHERE q.id = question_responses.question_id
        AND NOW() >= q.start_date
        AND NOW() < q.end_date
    )
  );

-- Editing your own answer, subject to the same open-window rule: once a
-- question closes, the record of what people said is fixed.
DROP POLICY IF EXISTS "Users can update their own question responses" ON public.question_responses;
CREATE POLICY "Users can update their own question responses"
  ON public.question_responses
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.community_questions q
      WHERE q.id = question_responses.question_id
        AND NOW() >= q.start_date
        AND NOW() < q.end_date
    )
  );

-- Withdrawing an answer is always allowed, even after the question closes: a
-- member must be able to retract something they said publicly.
DROP POLICY IF EXISTS "Users can delete their own question responses" ON public.question_responses;
CREATE POLICY "Users can delete their own question responses"
  ON public.question_responses
  FOR DELETE
  USING (auth.uid() = user_id);
