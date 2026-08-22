"use client";

import { useEffect, useState } from "react";
import { useUserStore } from "@/store/useUserStore";
import type { ItemReactionType } from "@/types/database";
import styles from "./ReactionBar.module.css";

interface ReactionCounts {
  thumbs_up: number;
  insightful: number;
  favorite: number;
}

interface ReactionsResponse {
  counts: ReactionCounts;
  userReactions: ItemReactionType[];
}

const REACTIONS: { type: ItemReactionType; label: string }[] = [
  { type: "thumbs_up", label: "Thumbs up" },
  { type: "insightful", label: "Insightful" },
  { type: "favorite", label: "Favorite" },
];

function ReactionIcon({ type }: { type: ItemReactionType }) {
  if (type === "thumbs_up") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 10v11" />
        <path d="M11 21h6.5a2 2 0 0 0 2-1.6l1.2-6.4a2 2 0 0 0-2-2.4H14l.8-4.2a1.6 1.6 0 0 0-2.9-1.2L7 10H3v11h4" />
      </svg>
    );
  }

  if (type === "insightful") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2.05V17h6v-.25c0-.85.4-1.55 1-2.05A7 7 0 0 0 12 2z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

interface ReactionBarProps {
  itemId: string;
  className?: string;
}

export default function ReactionBar({ itemId, className }: ReactionBarProps) {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const [counts, setCounts] = useState<ReactionCounts>({
    thumbs_up: 0,
    insightful: 0,
    favorite: 0,
  });
  const [userReactions, setUserReactions] = useState<ItemReactionType[]>([]);
  const [pending, setPending] = useState<ItemReactionType | null>(null);

  useEffect(() => {
    if (!itemId) return;
    let isCancelled = false;

    fetch(`/api/items/${itemId}/reactions`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: ReactionsResponse | null) => {
        if (!isCancelled && payload) {
          setCounts(payload.counts);
          setUserReactions(payload.userReactions);
        }
      })
      .catch((error) => console.error("Reaction counts fetch failed:", error));

    return () => {
      isCancelled = true;
    };
  }, [itemId]);

  async function handleReact(event: React.MouseEvent, type: ItemReactionType) {
    event.preventDefault();
    event.stopPropagation();

    if (!isAuthenticated || pending) return;

    setPending(type);
    try {
      const response = await fetch(`/api/items/${itemId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction_type: type }),
      });

      if (!response.ok) return;

      const payload = (await response.json()) as ReactionsResponse;
      setCounts(payload.counts);
      setUserReactions(payload.userReactions);
    } catch (error) {
      console.error("Reaction toggle failed:", error);
    } finally {
      setPending(null);
    }
  }

  return (
    <span className={`${styles.bar} ${className ?? ""}`}>
      {REACTIONS.map(({ type, label }) => {
        const active = userReactions.includes(type);
        return (
          <button
            key={type}
            type="button"
            className={`${styles.button} ${active ? styles.active : ""}`}
            onClick={(event) => handleReact(event, type)}
            disabled={!isAuthenticated || pending !== null}
            aria-pressed={active}
            aria-label={label}
            title={isAuthenticated ? label : `Log in to react (${label})`}
          >
            <span className={styles.icon}>
              <ReactionIcon type={type} />
            </span>
            <span className={styles.count}>{counts[type]}</span>
          </button>
        );
      })}
    </span>
  );
}
