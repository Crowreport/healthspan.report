import styles from "./CommunityQuestionCard.module.css";

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

/**
 * Static placeholder matching the style guide's "Community Question" card
 * (section 4.8). Not wired to a real discussion feature yet — reserves the
 * right-column space per the /library mockup.
 */
export default function CommunityQuestionCard() {
  return (
    <section className={styles.card} aria-label="Community question">
      <div className={styles.header}>
        <span className={styles.iconChip}>
          <ChatIcon />
        </span>
        <h3 className={styles.title}>Community Question</h3>
      </div>
      <p className={styles.question}>What longevity study are you reading this week?</p>
      <p className={styles.description}>Share your take and see what others are exploring.</p>
      <button type="button" className={styles.cta} disabled title="Coming soon">
        Join the discussion
      </button>
    </section>
  );
}
