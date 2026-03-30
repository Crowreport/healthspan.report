import Link from "next/link";
import { SearchBar } from "@/components/ui";
import styles from "./HeroBanner.module.css";

export default function HeroBanner() {
  return (
    <section className={styles.hero}>
      <div className={styles.container}>
        <div className={styles.content}>
          <h1 className={styles.title}>
            Your Guide to
            <span className={styles.highlight}> Living Longer</span>
          </h1>
          <p className={styles.subtitle}>
            Evidence-based research, expert insights, and actionable strategies
            for optimizing your healthspan and extending your years of vibrant
            living.
          </p>
          <div className={styles.searchWrapper}>
            <SearchBar placeholder="Search for longevity topics..." />
          </div>
          <div className={styles.tags}>
            <span className={styles.tagLabel}>Popular:</span>
            <Link href="/topics/nad" className={styles.tag}>NAD+</Link>
            <Link href="/topics/fasting" className={styles.tag}>Fasting</Link>
            <Link href="/topics/rapamycin" className={styles.tag}>Rapamycin</Link>
            <Link href="/topics/sleep" className={styles.tag}>Sleep</Link>
          </div>
        </div>
        <div className={styles.visual}>
          <div className={styles.decorativeCircle}>
            <div className={styles.innerCircle}>
              <span className={styles.stat}>
                <span className={styles.statNumber}>120+</span>
                <span className={styles.statLabel}>Research Articles</span>
              </span>
            </div>
          </div>
          <div className={styles.floatingCard} style={{ "--delay": "0s" } as React.CSSProperties}>
            <span className={styles.cardIcon}>🧬</span>
            <span className={styles.cardText}>Cellular Health</span>
          </div>
          <div className={styles.floatingCard} style={{ "--delay": "0.5s" } as React.CSSProperties}>
            <span className={styles.cardIcon}>🏃</span>
            <span className={styles.cardText}>Fitness</span>
          </div>
          <div className={styles.floatingCard} style={{ "--delay": "1s" } as React.CSSProperties}>
            <span className={styles.cardIcon}>🥗</span>
            <span className={styles.cardText}>Nutrition</span>
          </div>
        </div>
      </div>
    </section>
  );
}
