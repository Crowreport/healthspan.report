"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { useSavedStore } from "@/store/useSavedStore";
import styles from "./BookmarkButton.module.css";

interface BookmarkButtonProps {
  itemId: string;
  variant?: "icon" | "button";
  className?: string;
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function BookmarkButton({
  itemId,
  variant = "icon",
  className = "",
}: BookmarkButtonProps) {
  const router = useRouter();
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const { savedMap, loaded, fetchSaved, toggleSave } = useSavedStore();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !loaded) {
      void fetchSaved();
    }
  }, [isAuthenticated, loaded, fetchSaved]);

  const isSaved = Boolean(savedMap[itemId]);

  async function handleClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    if (pending) return;

    setPending(true);
    try {
      await toggleSave(itemId);
    } finally {
      setPending(false);
    }
  }

  if (variant === "button") {
    return (
      <button
        type="button"
        className={`${styles.pillButton} ${isSaved ? styles.savedPill : ""} ${className}`}
        onClick={handleClick}
        disabled={pending}
        aria-pressed={isSaved}
        aria-label={isSaved ? "Remove from Library" : "Save to Library"}
        title={!isAuthenticated ? "Log in to save" : isSaved ? "Saved in Library" : "Save to Library"}
      >
        <span className={styles.pillIcon}>
          <BookmarkIcon filled={isSaved} />
        </span>
        <span className={styles.pillLabel}>
          {isSaved ? "Saved" : "Save to Library"}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`${styles.iconButton} ${isSaved ? styles.savedIcon : ""} ${className}`}
      onClick={handleClick}
      disabled={pending}
      aria-pressed={isSaved}
      aria-label={isSaved ? "Remove from Library" : "Save to Library"}
      title={!isAuthenticated ? "Log in to save" : isSaved ? "Saved in Library" : "Save to Library"}
    >
      <BookmarkIcon filled={isSaved} />
    </button>
  );
}
