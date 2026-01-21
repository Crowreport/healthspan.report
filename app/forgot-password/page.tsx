"use client";

import { useState } from "react";
import Link from "next/link";

import { createClient } from "@/utils/supabase/client";
import { Header, Footer } from "@/components/layout";
import { Button, Input, Logo } from "@/components/ui";
import styles from "./page.module.css";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSendReset() {
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setLoading(true);
    setError("");

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
    } else {
      setEmailSent(true);
    }
  }

  if (emailSent) {
    return (
      <div className={styles.page}>
        <Header />
        <main className={styles.main}>
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
                  We&apos;ve sent a password reset link to
                </p>
                <p className={styles.email}>{email}</p>
              </div>

              <div className={styles.instructions}>
                <p>
                  Click the link in your email to reset your password. The link
                  will expire in 1 hour.
                </p>

                <div className={styles.tip}>
                  <strong>Can&apos;t find the email?</strong>
                  <br />
                  Check your spam folder or try sending another reset email.
                </div>

                <Button
                  variant="secondary"
                  onClick={() => {
                    setEmailSent(false);
                    setEmail("");
                  }}
                  fullWidth
                >
                  Send another email
                </Button>
              </div>

              <p className={styles.footerText}>
                <Link href="/login" className={styles.link}>
                  ← Back to sign in
                </Link>
              </p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.card}>
            <div className={styles.header}>
              <Logo size="md" showText={false} />
              <h1 className={styles.title}>Forgot your password?</h1>
              <p className={styles.subtitle}>
                No worries! Enter your email address and we&apos;ll send you a
                link to reset your password.
              </p>
            </div>

            {error && <div className={styles.alert} data-type="error">{error}</div>}

            <form className={styles.form} onSubmit={(e) => { e.preventDefault(); handleSendReset(); }}>
              <Input
                id="email"
                type="email"
                label="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
              />

              <Button type="submit" disabled={loading} fullWidth>
                {loading ? "Sending..." : "Send reset email"}
              </Button>
            </form>

            <p className={styles.footerText}>
              <Link href="/login" className={styles.link}>
                ← Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
