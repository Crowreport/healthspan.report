"use client";

import Link from "next/link";
import styles from "./Logo.module.css";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export default function Logo({ size = "md", showText = true }: LogoProps) {
  return (
    <Link href="/" className={styles.logo}>
      <div className={`${styles.mark} ${styles[size]}`}>
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={styles.icon}
        >
          {/* DNA Helix-inspired infinity/longevity symbol */}
          <circle
            cx="20"
            cy="20"
            r="18"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />
          <path
            d="M12 20C12 16 15 13 20 13C25 13 28 16 28 20C28 24 25 27 20 27C15 27 12 24 12 20Z"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />
          <path
            d="M14 16L26 24M14 24L26 16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="20" cy="20" r="3" fill="currentColor" />
        </svg>
      </div>
      {showText && (
        <span className={styles.text}>
          Health<span className={styles.accent}>span</span>
        </span>
      )}
    </Link>
  );
}
