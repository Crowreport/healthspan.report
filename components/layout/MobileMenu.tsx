"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Logo, Button, SearchBar } from "@/components/ui";
import { navItems } from "@/data/mockData";
import { useUserStore } from "@/store/useUserStore";
import { createClient } from "@/utils/supabase/client";
import styles from "./MobileMenu.module.css";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const profile = useUserStore((s) => s.profile);
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const clearProfile = useUserStore((s) => s.clearProfile);
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    clearProfile();
    onClose();
  }

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
      />

      {/* Menu Panel */}
      <div className={`${styles.menu} ${isOpen ? styles.open : ""}`}>
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
          {isAuthenticated && profile ? (
            <div className={styles.authenticatedSection}>
              <Link href="/settings" onClick={onClose} className={styles.navLink}>
                Settings
              </Link>
              <Button variant="outline" fullWidth onClick={handleLogout}>
                Sign out
              </Button>
            </div>
          ) : (
            <>
              <Link href="/login" onClick={onClose}>
                <Button variant="primary" fullWidth>
                  Log in
                </Button>
              </Link>
              <Link href="/signup" onClick={onClose}>
                <Button variant="primary" fullWidth>
                  Sign up
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
