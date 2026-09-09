# Community Questions API — Week 6 Backend

The "question of the week": an admin-authored prompt that members answer, with
a live participation count.

Migration: `supabase/migrations/020_community_questions.sql`

## 1. Data model

### `public.community_questions`

| Column          | Type          | Notes                                    |
| --------------- | ------------- | ---------------------------------------- |
| `id`            | `UUID`        | Primary key, `gen_random_uuid()`         |
| `question_text` | `TEXT`        | The prompt. Blank/whitespace rejected    |
| `description`   | `TEXT`        | Optional framing shown under the prompt  |
| `start_date`    | `TIMESTAMPTZ` | **Inclusive** start of the active window |
| `end_date`      | `TIMESTAMPTZ` | **Exclusive** end of the active window   |
| `created_at`    | `TIMESTAMPTZ` | Defaults to `NOW()`                      |
| `updated_at`    | `TIMESTAMPTZ` | Maintained by trigger                    |

**There is no `is_active` flag.** A question is current when `NOW()` falls
inside `[start_date, end_date)`. A boolean was rejected because it needs a
writer to flip it — a cron, an admin remembering, or a bug — and the moment
that writer fails, the site shows a stale question. A time window is correct
with no moving parts, and it lets an admin schedule next week's question today.

`end_date` being **exclusive** means consecutive questions can share a boundary
timestamp and never both be current.

Two CHECK constraints: `question_text` must not be blank, and
`end_date > start_date` (a backwards window can never be current, so it is a
silent authoring mistake that would leave the site with no question at all).

### `public.question_responses`

| Column          | Type          | Notes                                             |
| --------------- | ------------- | ------------------------------------------------- |
| `id`            | `UUID`        | Primary key                                       |
| `question_id`   | `UUID`        | → `community_questions(id)` `ON DELETE CASCADE`   |
| `user_id`       | `UUID`        | → `users(id)` `ON DELETE CASCADE`                 |
| `response_text` | `TEXT`        | Non-blank, max 2000 chars — both enforced by CHECK |
| `created_at`    | `TIMESTAMPTZ` | Defaults to `NOW()`                               |
| `updated_at`    | `TIMESTAMPTZ` | Maintained by trigger                             |

**One row per `(question_id, user_id)`**, enforced by a unique index. A member
gets one answer per question. Threaded multi-answer discussion already exists as
`public.comments` (migration 012); this is the lighter "everyone answers the
same prompt" format, and one-answer-each is what keeps it readable and what
makes the response count meaningful as a participation number.

Answering again **edits** the existing row rather than adding a second answer.
That is why `question_responses` has an UPDATE policy while `item_reactions`
deliberately does not.

## 2. RLS

Both tables are **publicly readable** (`USING (true)`), like `item_reactions`
and unlike the library tables — the point of the feature is that the community
reads each other's replies.

Writes on `question_responses` require `auth.uid() = user_id` **and** that the
question's window is currently open. The window check lives in the policy, not
just the route, so a closed question cannot be answered through any client —
including a direct PostgREST call with a valid user token.

`DELETE` is the exception: withdrawing your own answer is allowed even after the
question closes, because a member must be able to retract something they said
publicly.

`community_questions` has **no member-facing write policy**. Questions are
authored through the Supabase dashboard or a service-role admin tool, both of
which bypass RLS. Adding a write policy here would let any signed-in user post a
question to the whole community.

## 3. Endpoints

### `GET /api/community/question/current`

Public. No auth required.

```json
{
  "question": {
    "id": "…", "question_text": "What one habit changed your sleep?",
    "description": null,
    "start_date": "2026-09-08T00:00:00Z", "end_date": "2026-09-15T00:00:00Z",
    "created_at": "…", "updated_at": "…"
  },
  "response_count": 42,
  "user_response": null
}
```

- `question` is `null` when nothing is scheduled right now. This returns **200**,
  not 404: a gap between questions is a normal state, and a 404 would make a
  client treat it as an error.
- `response_count` is an exact `head: true` count — the number without
  transferring a single row.
- `user_response` is the caller's own answer, or `null` when they have not
  answered or are anonymous. It lets a UI render the form pre-filled in "edit"
  mode rather than inviting a duplicate the unique index would reject.

### `POST /api/community/question/respond`

Requires a session. Rate limited to 30 writes per 10 minutes per user.

```json
{ "question_id": "<uuid>", "response_text": "Cutting caffeine after 2pm." }
```

`question_id` is **required**, not inferred from "whatever is current". A member
can spend minutes writing an answer, and if the question rolls over mid-compose
an inferred id would silently file that answer under the new prompt. An explicit
id turns that race into an honest 409.

| Status | Meaning                                                        |
| ------ | -------------------------------------------------------------- |
| `201`  | First answer created                                            |
| `200`  | Existing answer edited (`created: false`)                       |
| `400`  | Malformed body, blank text, or text over 2000 chars             |
| `401`  | Not signed in                                                   |
| `404`  | `question_id` does not exist                                    |
| `409`  | The question is not currently open                              |
| `429`  | Rate limited; `Retry-After` header set                          |

409 rather than 400 for a closed question: the payload is fine and the user was
allowed to make the request — the question just is not open any more.

## 4. Creating a question

No admin UI yet. Insert directly (service role / dashboard):

```sql
INSERT INTO public.community_questions (question_text, description, start_date, end_date)
VALUES (
  'What one habit most improved your sleep?',
  'Share what actually worked, not what you read.',
  NOW(),
  NOW() + INTERVAL '7 days'
);
```

Scheduling ahead works the same way — set `start_date` in the future and the
question becomes current on its own, with nothing to flip.
