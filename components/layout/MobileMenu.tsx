"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Logo, Button, SearchBar, ThemeToggle } from "@/components/ui";
import { navItems } from "@/data/mockData";
import styles from "./MobileMenu.module.css";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`${styles.backdrop} ${isOpen ? styles.open : ""}`}
        onClick={onClose}
        aria-hidden="true"
        style={{ zIndex: 40 }}
      />

      {/* Menu Panel */}
      <div className={`${styles.menu} ${isOpen ? styles.open : ""}`} style={{ zIndex: 50 }}>
        <div className={styles.header}>
          <Logo />
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close menu"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={styles.search}>
          <SearchBar />
        </div>

        <div className={styles.themeRow}>
          <p className={styles.themeLabel}>Appearance</p>
          <ThemeToggle compact />
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={styles.navLink}
              onClick={onClose}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.authSection}>
          <Link href="/login" onClick={onClose}>
            <Button variant="outline" fullWidth>
              Log in
            </Button>
          </Link>
          <Link href="/signup" onClick={onClose}>
            <Button variant="primary" fullWidth>
              Sign up
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}
