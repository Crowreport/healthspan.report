/**
 * Community Question card — GET/POST /api/community/question routes
 * (current + respond, backend from #29).
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUserStore } from "@/store/useUserStore";
import type { DBCommunityQuestion, DBQuestionResponse } from "@/types/database";
import styles from "./CommunityQuestionCard.module.css";

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

interface CurrentQuestionResponse {
  question: DBCommunityQuestion | null;
  response_count: number;
  user_response: DBQuestionResponse | null;
}

interface RespondErrorBody {
  error: string;
  retryAfterSec?: number;
}

type FormState = "closed" | "open" | "submitting";

export default function CommunityQuestionCard() {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);

  const [question, setQuestion] = useState<DBCommunityQuestion | null>(null);
  const [responseCount, setResponseCount] = useState(0);
  const [userResponse, setUserResponse] = useState<DBQuestionResponse | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [formState, setFormState] = useState<FormState>("closed");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    fetch("/api/community/question/current")
      .then((response) => (response.ok ? (response.json() as Promise<CurrentQuestionResponse>) : null))
      .then((payload) => {
        if (isCancelled || !payload) return;
        setQuestion(payload.question);
        setResponseCount(payload.response_count);
        setUserResponse(payload.user_response);
        setDraft(payload.user_response?.response_text ?? "");
      })
      .catch((err) => console.error("Community question fetch failed:", err))
      .finally(() => {
        if (!isCancelled) setLoaded(true);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!question) return;

    const text = draft.trim();
    if (!text) return;

    setError(null);
    setFormState("submitting");

    try {
      const response = await fetch("/api/community/question/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: question.id, response_text: text }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as RespondErrorBody | null;
        if (response.status === 429 && body?.retryAfterSec) {
          setError(`Too many responses — try again in ${body.retryAfterSec}s.`);
        } else if (response.status === 409) {
          setError("This question just closed — check back for the next one.");
        } else {
          setError(body?.error ?? "Couldn't submit your response.");
        }
        setFormState("open");
        return;
      }

      const payload = (await response.json()) as { response: DBQuestionResponse; created: boolean };
      if (payload.created) setResponseCount((count) => count + 1);
      setUserResponse(payload.response);
      setFormState("closed");
    } catch (err) {
      console.error("Respond failed:", err);
      setError("Couldn't reach the server — try again.");
      setFormState("open");
    }
  }

  // Nothing scheduled right now — a normal state, not an error. No card to show.
  if (!loaded || !question) return null;

  return (
    <section className={styles.card} aria-label="Community question">
      <div className={styles.header}>
        <span className={styles.iconChip}>
          <ChatIcon />
        </span>
        <h3 className={styles.title}>Community Question</h3>
      </div>

      <p className={styles.question}>{question.question_text}</p>
      {question.description && <p className={styles.description}>{question.description}</p>}
      <p className={styles.responseCount}>
        {responseCount} response{responseCount === 1 ? "" : "s"} this week
      </p>

      {!isAuthenticated ? (
        <Link href="/login" className={styles.cta}>
          Log in to join
        </Link>
      ) : formState === "closed" ? (
        <button type="button" className={styles.cta} onClick={() => setFormState("open")}>
          {userResponse ? "Edit your response" : "Join the discussion"}
        </button>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit}>
          <textarea
            className={styles.textarea}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Share your take…"
            rows={3}
            maxLength={2000}
            autoFocus
            disabled={formState === "submitting"}
          />
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.formActions}>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={formState === "submitting" || !draft.trim()}
            >
              {formState === "submitting" ? "Posting…" : userResponse ? "Update" : "Post"}
            </button>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={() => {
                setFormState("closed");
                setError(null);
                setDraft(userResponse?.response_text ?? "");
              }}
              disabled={formState === "submitting"}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
