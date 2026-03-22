"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ThemeToggle.module.css";

interface ThemeToggleProps {
  compact?: boolean;
}

type ThemePreference = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "healthspan-theme";

const optionLabels: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

function getStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return preference;
}

function applyTheme(preference: ThemePreference) {
  const resolved = resolveTheme(preference);
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.style.colorScheme = resolved;
  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
}

export default function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyTheme(getStoredPreference());
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      if (getStoredPreference() === "system") {
        applyTheme("system");
      }
    };
    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () =>
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, []);

  function handleSelect(nextPreference: ThemePreference) {
    applyTheme(nextPreference);
    setIsOpen(false);
  }

  const activePreference =
    typeof window === "undefined" ? "system" : getStoredPreference();

  return (
    <div
      className={`${styles.wrapper} ${compact ? styles.compact : ""}`}
      ref={wrapperRef}
    >
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Theme options"
        aria-expanded={isOpen}
      >
        <span className={styles.triggerLabel}>
          {compact ? "Theme" : "Appearance"}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className={`${styles.chevron} ${isOpen ? styles.chevronUp : ""}`}
          aria-hidden="true"
        >
          <path d="M5.5 7.5L10 12.2l4.5-4.7" />
        </svg>
      </button>

      {isOpen && (
        <div className={styles.menu} role="menu" aria-label="Theme selection">
          {(Object.keys(optionLabels) as ThemePreference[]).map((option) => (
            <button
              key={option}
              type="button"
              className={`${styles.option} ${
                activePreference === option ? styles.optionActive : ""
              }`}
              onClick={() => handleSelect(option)}
              role="menuitemradio"
              aria-checked={activePreference === option}
            >
              <span>{optionLabels[option]}</span>
              {activePreference === option && <span className={styles.dot} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
