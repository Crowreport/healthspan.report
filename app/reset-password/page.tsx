"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/utils/supabase/client";
import { Header, Footer } from "@/components/layout";
import { Button, Input, Logo } from "@/components/ui";
import styles from "./page.module.css";

function ResetPasswordForm() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsValidSession(false);
        setError("Invalid or expired reset link. Please request a new one.");
        setTimeout(() => {
          router.push("/forgot-password");
        }, 3000);
      } else {
        setIsValidSession(true);
      }
    };

    checkSession();
  }, [supabase.auth, router]);

  async function handleUpdatePassword() {
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage("Password updated successfully!");
      await supabase.auth.signOut();
      setTimeout(() => {
        router.push("/login?message=password-updated");
      }, 1500);
    }
  }

  if (isValidSession === null) {
    return (
      <div className={styles.loading}>
        <p>Verifying reset link...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Logo size="md" showText={false} />
          <h1 className={styles.title}>Set new password</h1>
          <p className={styles.subtitle}>
            Please enter your new password below
          </p>
        </div>

        {error && <div className={styles.alert} data-type="error">{error}</div>}
        {message && <div className={styles.alert} data-type="success">{message}</div>}

        {isValidSession && (
          <form className={styles.form} onSubmit={(e) => { e.preventDefault(); handleUpdatePassword(); }}>
            <Input
              id="password"
              type="password"
              label="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your new password"
              helperText="At least 6 characters"
              required
              disabled={loading}
            />

            <Input
              id="confirmPassword"
              type="password"
              label="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your new password"
              required
              disabled={loading}
            />

            <Button type="submit" disabled={loading} fullWidth>
              {loading ? "Updating password..." : "Update password"}
            </Button>
          </form>
        )}

        <p className={styles.footerText}>
          <Link href="/login" className={styles.link}>
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
