/**
 * Community question logic tests (migration 020).
 *
 * Covers the parts that don't need a Supabase session: the time-window rule
 * that decides which question is current, and the one-answer-per-member
 * cardinality with its edit-in-place behaviour.
 *
 * Run against an in-memory stand-in that enforces the same constraints as the
 * migration — the unique index on (question_id, user_id), the non-blank and
 * length CHECKs, and the open-window rule from the RLS policies.
 *
 * Usage: node scripts/test-community-questions.mjs
 */

const UNIQUE_VIOLATION = "23505";
const RESPONSE_TEXT_MAX_LENGTH = 2000;

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n${title}:`);
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

class Community {
  constructor() {
    this.questions = [];
    this.responses = [];
    this.seq = 0;
  }

  #id(prefix) {
    this.seq += 1;
    return `${prefix}-${this.seq}`;
  }

  addQuestion({ text = "A question?", description = null, start, end }) {
    if (!String(text).trim()) throw new Error("question_text must not be blank");
    // CHECK (end_date > start_date)
    if (!(end > start)) throw new Error("end_date must be after start_date");

    const q = {
      id: this.#id("question"),
      question_text: text,
      description,
      start_date: new Date(start).toISOString(),
      end_date: new Date(end).toISOString(),
    };
    this.questions.push(q);
    return q;
  }

  /** Mirrors fetchCurrentQuestionRow: window contains now, newest start wins. */
  currentQuestion(now) {
    const t = now instanceof Date ? now.getTime() : now;
    return (
      this.questions
        .filter(
          (q) =>
            t >= new Date(q.start_date).getTime() && t < new Date(q.end_date).getTime()
        )
        .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))[0] ?? null
    );
  }

  isOpen(questionId, now) {
    const q = this.questions.find((x) => x.id === questionId);
    if (!q) return false;
    const t = now instanceof Date ? now.getTime() : now;
    return t >= new Date(q.start_date).getTime() && t < new Date(q.end_date).getTime();
  }

  /** Mirrors submitQuestionResponse, including the RLS open-window rule. */
  respond(questionId, userId, text, now) {
    const trimmed = String(text ?? "").trim();
    if (!trimmed) return { error: "Response text is required" };
    if (trimmed.length > RESPONSE_TEXT_MAX_LENGTH) {
      return { error: "Response too long" };
    }

    const question = this.questions.find((q) => q.id === questionId);
    if (!question) return { error: "Question not found", notFound: true };
    if (!this.isOpen(questionId, now)) {
      return { error: "This question is not currently accepting responses", closed: true };
    }

    const existing = this.responses.find(
      (r) => r.question_id === questionId && r.user_id === userId
    );

    if (existing) {
      existing.response_text = trimmed;
      return { data: { response: existing, created: false } };
    }

    const row = {
      id: this.#id("response"),
      question_id: questionId,
      user_id: userId,
      response_text: trimmed,
    };
    this.responses.push(row);
    return { data: { response: row, created: true } };
  }

  /** A second INSERT for the same pair must be impossible. */
  forceInsert(questionId, userId, text) {
    const clash = this.responses.some(
      (r) => r.question_id === questionId && r.user_id === userId
    );
    if (clash) {
      const err = new Error("duplicate key value violates unique constraint");
      err.code = UNIQUE_VIOLATION;
      throw err;
    }
    const row = { id: this.#id("response"), question_id: questionId, user_id: userId, response_text: text };
    this.responses.push(row);
    return row;
  }

  responseCount(questionId) {
    return this.responses.filter((r) => r.question_id === questionId).length;
  }

  userResponse(questionId, userId) {
    return this.responses.find((r) => r.question_id === questionId && r.user_id === userId) ?? null;
  }

  deleteResponse(questionId, userId) {
    const idx = this.responses.findIndex(
      (r) => r.question_id === questionId && r.user_id === userId
    );
    if (idx === -1) return false;
    this.responses.splice(idx, 1);
    return true;
  }

  /** ON DELETE CASCADE from community_questions. */
  deleteQuestion(questionId) {
    this.questions = this.questions.filter((q) => q.id !== questionId);
    this.responses = this.responses.filter((r) => r.question_id !== questionId);
  }
}

const now = new Date("2026-09-08T12:00:00Z").getTime();

section("Current question: the time window");
{
  const c = new Community();
  const active = c.addQuestion({ text: "Active", start: now - DAY, end: now + DAY });
  c.addQuestion({ text: "Past", start: now - 10 * DAY, end: now - 5 * DAY });
  c.addQuestion({ text: "Future", start: now + 5 * DAY, end: now + 10 * DAY });

  const current = c.currentQuestion(now);
  check("the open question is current", current?.id === active.id);
  check("a past question is not current", current?.question_text !== "Past");
  check("a scheduled question is not current", current?.question_text !== "Future");

  check("nothing is current before it starts", c.currentQuestion(now - 7 * DAY)?.question_text !== "Active");
  check("a future question becomes current on its own", c.currentQuestion(now + 6 * DAY)?.question_text === "Future");
}

section("Window boundaries: start inclusive, end exclusive");
{
  const c = new Community();
  const q = c.addQuestion({ text: "Boundary", start: now, end: now + DAY });

  check("current exactly at start_date (inclusive)", c.currentQuestion(now)?.id === q.id);
  check("current one ms after start", c.currentQuestion(now + 1)?.id === q.id);
  check("current one ms before end", c.currentQuestion(now + DAY - 1)?.id === q.id);
  check("NOT current exactly at end_date (exclusive)", c.currentQuestion(now + DAY) === null);
}

section("Back-to-back questions never overlap");
{
  const c = new Community();
  const first = c.addQuestion({ text: "Week one", start: now, end: now + 7 * DAY });
  const second = c.addQuestion({ text: "Week two", start: now + 7 * DAY, end: now + 14 * DAY });

  check("week one is current mid-window", c.currentQuestion(now + 3 * DAY)?.id === first.id);
  check("week two takes over at the shared boundary", c.currentQuestion(now + 7 * DAY)?.id === second.id);
  check("exactly one is current at the boundary", c.currentQuestion(now + 7 * DAY)?.id !== first.id);
}

section("Gaps between questions");
{
  const c = new Community();
  c.addQuestion({ text: "Ended", start: now - 10 * DAY, end: now - DAY });

  check("no current question returns null, not an error", c.currentQuestion(now) === null);
  check("the count for a gap is zero", c.responseCount("nonexistent") === 0);
}

section("Invalid windows are rejected");
{
  const c = new Community();
  let threw = false;
  try {
    c.addQuestion({ text: "Backwards", start: now + DAY, end: now });
  } catch {
    threw = true;
  }
  check("end_date before start_date is rejected", threw);

  let blankThrew = false;
  try {
    c.addQuestion({ text: "   ", start: now, end: now + DAY });
  } catch {
    blankThrew = true;
  }
  check("a blank question_text is rejected", blankThrew);
}

section("Responses: one per member, edited in place");
{
  const c = new Community();
  const q = c.addQuestion({ text: "Q", start: now - HOUR, end: now + DAY });

  const first = c.respond(q.id, "user-1", "Cutting caffeine after 2pm.", now);
  check("a first answer is created", first.data?.created === true);
  check("the count is 1", c.responseCount(q.id) === 1);

  const second = c.respond(q.id, "user-1", "Actually, a consistent bedtime.", now);
  check("answering again is an edit, not a create", second.data?.created === false);
  check("the count stays 1", c.responseCount(q.id) === 1);
  check("the text is updated", c.userResponse(q.id, "user-1").response_text === "Actually, a consistent bedtime.");

  c.respond(q.id, "user-2", "Blackout curtains.", now);
  check("another member adds to the count", c.responseCount(q.id) === 2);

  let dupeCode = null;
  try {
    c.forceInsert(q.id, "user-1", "A sneaky second row");
  } catch (err) {
    dupeCode = err.code;
  }
  check("a second row for the same member is impossible", dupeCode === UNIQUE_VIOLATION);
}

section("Responses: the open-window rule");
{
  const c = new Community();
  const closed = c.addQuestion({ text: "Closed", start: now - 10 * DAY, end: now - DAY });
  const future = c.addQuestion({ text: "Future", start: now + DAY, end: now + 2 * DAY });
  const open = c.addQuestion({ text: "Open", start: now - HOUR, end: now + HOUR });

  check("answering a closed question is refused", c.respond(closed.id, "user-1", "Late.", now).closed === true);
  check("answering a scheduled question is refused", c.respond(future.id, "user-1", "Early.", now).closed === true);
  check("answering the open question works", c.respond(open.id, "user-1", "On time.", now).data?.created === true);
  check("a missing question reads as not found", c.respond("nope", "user-1", "Hello there.", now).notFound === true);

  // The window closes while the member is composing.
  const later = now + 2 * HOUR;
  check("an answer arriving after close is refused", c.respond(open.id, "user-2", "Too late.", later).closed === true);
  check("the earlier answer survives the close", c.responseCount(open.id) === 1);
}

section("Responses: validation");
{
  const c = new Community();
  const q = c.addQuestion({ text: "Q", start: now - HOUR, end: now + DAY });

  check("blank text is rejected", Boolean(c.respond(q.id, "user-1", "   ", now).error));
  check("empty text is rejected", Boolean(c.respond(q.id, "user-1", "", now).error));
  check("text over the cap is rejected", Boolean(c.respond(q.id, "user-1", "x".repeat(2001), now).error));
  check("text at exactly the cap is accepted", Boolean(c.respond(q.id, "user-1", "x".repeat(2000), now).data));
  check("surrounding whitespace is trimmed", c.respond(q.id, "user-2", "  Trimmed answer.  ", now).data.response.response_text === "Trimmed answer.");
  check("nothing invalid was stored", c.responseCount(q.id) === 2);
}

section("Withdrawal and cascade");
{
  const c = new Community();
  const q = c.addQuestion({ text: "Q", start: now - HOUR, end: now + HOUR });
  c.respond(q.id, "user-1", "My answer here.", now);
  c.respond(q.id, "user-2", "Another answer.", now);

  check("a member can withdraw their answer", c.deleteResponse(q.id, "user-1") === true);
  check("the count drops", c.responseCount(q.id) === 1);
  check("the other member's answer is untouched", c.userResponse(q.id, "user-2") !== null);
  check("withdrawing twice is a no-op", c.deleteResponse(q.id, "user-1") === false);

  c.deleteQuestion(q.id);
  check("deleting a question cascades to its answers", c.responseCount(q.id) === 0);
}

section("Per-question isolation");
{
  const c = new Community();
  const q1 = c.addQuestion({ text: "One", start: now - HOUR, end: now + HOUR });
  const q2 = c.addQuestion({ text: "Two", start: now - HOUR, end: now + HOUR });

  c.respond(q1.id, "user-1", "Answer to one.", now);
  c.respond(q2.id, "user-1", "Answer to two.", now);

  check("the same member may answer different questions", c.responseCount(q1.id) === 1 && c.responseCount(q2.id) === 1);
  check("answers do not bleed across questions", c.userResponse(q1.id, "user-1").response_text === "Answer to one.");
  check("a member with no answer reads as null", c.userResponse(q1.id, "user-99") === null);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
