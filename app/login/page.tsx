"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";

import { createClient } from "@/utils/supabase/client";
import { Header, Footer } from "@/components/layout";
import { Button, Input, Logo } from "@/components/ui";
import { useUserStore } from "@/store/useUserStore";
import styles from "./page.module.css";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const setProfile = useUserStore((s) => s.setProfile);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const msg = searchParams.get("message");
    if (msg === "email-verified") {
      setMessage("Email verified successfully! You can now sign in.");
    } else if (msg === "verification-error") {
      setError("Email verification failed. Please try again.");
    } else if (msg === "password-updated") {
      setMessage("Password updated successfully! Please sign in with your new password.");
    }
  }, [searchParams]);

  async function handleLogin() {
    setError("");
    setMessage("");
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setLoading(false);
      if (signInError.message === "Email not confirmed") {
        setError("Please verify your email before signing in");
        router.push(`/check-email?email=${encodeURIComponent(email)}`);
      } else {
        setError("Invalid credentials. Please check your email and password.");
      }
      return;
    }

    // Fetch user profile from database
    if (data.user) {
      try {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("id, username, first_name, last_name, role")
          .eq("id", data.user.id)
          .single();

        if (userError || !userData) {
          setLoading(false);
          setError("Login successful, but couldn't load profile.");
          return;
        }

        setProfile({
          id: data.user.id,
          username: userData.username,
          firstName: userData.first_name,
          lastName: userData.last_name,
          role: userData.role,
          email: data.user.email || "",
        });

        setMessage("You've successfully signed in!");

        setTimeout(() => {
          router.push("/");
        }, 1000);
      } catch (profileError) {
        console.error("Profile fetch failed:", profileError);
        setLoading(false);
        setError("Login successful, but couldn't load profile.");
      }
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Logo size="md" showText={false} />
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.subtitle}>Sign in to your Healthspan account</p>
        </div>

        {error && <div className={styles.alert} data-type="error">{error}</div>}
        {message && <div className={styles.alert} data-type="success">{message}</div>}

        <form className={styles.form} onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
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

          <Input
            id="password"
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            disabled={loading}
          />

          <div className={styles.forgotLink}>
            <Link href="/forgot-password">Forgot your password?</Link>
          </div>

          <Button type="submit" disabled={loading} fullWidth>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className={styles.footerText}>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className={styles.link}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
          <LoginForm />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
