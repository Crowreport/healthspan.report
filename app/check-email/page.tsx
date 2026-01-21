"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";

import { Header, Footer } from "@/components/layout";
import { Button } from "@/components/ui";
import styles from "./page.module.css";

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "your email";

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <h1 className={styles.title}>Check your email</h1>
          <p className={styles.subtitle}>
            We&apos;ve sent a verification link to
          </p>
          <p className={styles.email}>{email}</p>
        </div>

        <div className={styles.instructions}>
          <p>
            Click the link in your email to verify your account. Once verified,
            you can sign in to Healthspan.
          </p>

          <div className={styles.tip}>
            <strong>Can&apos;t find the email?</strong>
            <br />
            Check your spam folder. Verification emails sometimes end up there.
          </div>

          <div className={styles.actions}>
            <Link href="/login">
              <Button variant="primary" fullWidth>
                Go to sign in
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
          <CheckEmailContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
