import styles from "./CommentBubble.module.css";

interface CommentBubbleProps {
  /** Comment count. Undefined = still loading; 0 = loaded, no comments. */
  count?: number;
  className?: string;
}

export default function CommentBubble({ count, className }: CommentBubbleProps) {
  return (
    <span
      className={`${styles.bubble} ${className ?? ""}`}
      aria-label={count === undefined ? "Comments" : `${count} comment${count === 1 ? "" : "s"}`}
      title="Comments"
    >
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span className={styles.count}>{count ?? 0}</span>
    </span>
  );
}
