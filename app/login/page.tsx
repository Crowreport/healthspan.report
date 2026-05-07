"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
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
  const queryMessage = searchParams.get("message");
  const initialFeedback = (() => {
    if (queryMessage === "email-verified") {
      return {
        message: "Email verified successfully! You can now sign in.",
        error: "",
      };
    }

    if (queryMessage === "verification-error") {
      return {
        message: "",
        error: "Email verification failed. Please try again.",
      };
    }

    if (queryMessage === "password-updated") {
      return {
        message: "Password updated successfully! Please sign in with your new password.",
        error: "",
      };
    }

    return { message: "", error: "" };
  })();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialFeedback.error);
  const [message, setMessage] = useState(initialFeedback.message);
  const [loading, setLoading] = useState(false);

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

  async function handleGoogleSignIn() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/confirm`,
    },
  });
  if (error) setError(error.message);
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

          

          <Button type="submit" disabled={loading} fullWidth>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className={styles.forgotLink}>
            <Link href="/forgot-password">Forgot your password?</Link>
          </div>

        <button type="button" className={styles.googleButton} onClick={handleGoogleSignIn}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z"/>
            </svg>
            Continue with Google
          </button>
          
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
