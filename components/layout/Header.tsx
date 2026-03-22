"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo, SearchBar, Button, ThemeToggle } from "@/components/ui";
import MobileMenu from "./MobileMenu";
import { navItems } from "@/data/mockData";
import { useUserStore } from "@/store/useUserStore";
import { createClient } from "@/utils/supabase/client";
import styles from "./Header.module.css";

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const profile = useUserStore((s) => s.profile);
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const clearProfile = useUserStore((s) => s.clearProfile);

  async function handleLogout() {
    await supabase.auth.signOut();
    clearProfile();
    setShowDropdown(false);
    router.push("/");
  }

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        {/* Logo */}
        <Logo />

        {/* Desktop Navigation */}
        <nav className={styles.nav}>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={styles.navLink}>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Search Bar - Desktop */}
        <div className={styles.searchWrapper}>
          <SearchBar />
        </div>

        {/* Auth Section - Desktop */}
        <div className={styles.authButtons}>
          <ThemeToggle compact />

          {isAuthenticated && profile ? (
            <div className={styles.userMenu}>
              <button
                className={styles.userButton}
                onClick={() => setShowDropdown(!showDropdown)}
                aria-expanded={showDropdown}
              >
                <span className={styles.avatar}>
                  {profile.firstName?.charAt(0) || profile.username?.charAt(0) || "U"}
                </span>
                <span className={styles.userName}>
                  {profile.firstName || profile.username}
                </span>
                <svg
                  className={`${styles.chevron} ${showDropdown ? styles.chevronUp : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {showDropdown && (
                <div className={styles.dropdown}>
                  <div className={styles.dropdownHeader}>
                    <p className={styles.dropdownName}>
                      {profile.firstName} {profile.lastName}
                    </p>
                    <p className={styles.dropdownEmail}>{profile.email}</p>
                  </div>
                  <div className={styles.dropdownDivider} />
                  <Link
                    href="/profile"
                    className={styles.dropdownItem}
                    onClick={() => setShowDropdown(false)}
                  >
                    Profile Settings
                  </Link>
                  <button
                    className={styles.dropdownItem}
                    onClick={handleLogout}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login">
                <Button variant="primary" size="sm">
                  Log in
                </Button>
              </Link>
              <Link href="/signup">
                <Button variant="primary" size="sm">
                  Sign up
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className={styles.mobileActions}>
          <ThemeToggle compact />
          <button
            className={styles.mobileMenuButton}
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
    </header>
  );
}
