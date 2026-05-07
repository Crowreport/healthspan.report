"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

import { createClient } from "@/utils/supabase/client";
import { Header, Footer } from "@/components/layout";
import { Button, Input, Logo } from "@/components/ui";
import styles from "./page.module.css";

export default function SignUpPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSignUp() {
    setError("");
    setMessage("");

    // Validation
    if (!username.trim()) {
      setError("Username is required");
      return;
    }

    if (username.trim().length < 3 || username.trim().length > 20) {
      setError("Username must be between 3 and 20 characters");
      return;
    }

    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      setError("Username can only contain letters, numbers, and underscores");
      return;
    }

    if (!firstName.trim()) {
      setError("First name is required");
      return;
    }

    if (!lastName.trim()) {
      setError("Last name is required");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/confirm`,
        data: {
          username: username.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          role: "member",
        },
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.user && !data.user.email_confirmed_at) {
      setMessage("Registration successful! Please check your email to verify your account.");
      setTimeout(() => {
        router.push(`/check-email?email=${encodeURIComponent(email)}`);
      }, 2000);
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
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.card}>
            <div className={styles.header}>
              <Logo size="md" showText={false} />
              <h1 className={styles.title}>Create your account</h1>
              <p className={styles.subtitle}>
                Join the Healthspan community
              </p>
            </div>

            {error && <div className={styles.alert} data-type="error">{error}</div>}
            {message && <div className={styles.alert} data-type="success">{message}</div>}

            <form className={styles.form} onSubmit={(e) => { e.preventDefault(); handleSignUp(); }}>
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
                id="username"
                type="text"
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                helperText="3-20 characters, letters, numbers, and underscores only"
                required
                disabled={loading}
              />

              <div className={styles.nameRow}>
                <Input
                  id="firstName"
                  type="text"
                  label="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  required
                  disabled={loading}
                />
                <Input
                  id="lastName"
                  type="text"
                  label="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  required
                  disabled={loading}
                />
              </div>

              <Input
                id="password"
                type="password"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                helperText="At least 6 characters"
                required
                disabled={loading}
              />

              <Input
                id="confirmPassword"
                type="password"
                label="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                disabled={loading}
              />

              <Button type="submit" disabled={loading} fullWidth>
                {loading ? "Creating account..." : "Create account"}
              </Button>
            </form>
            <div className={styles.divider}>
            <span>or</span>
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
              Already have an account?{" "}
              <Link href="/login" className={styles.link}>
                Sign in
              </Link>
            </p>

            <p className={styles.terms}>
              By creating an account, you agree to our{" "}
              <Link href="/terms">Terms of Service</Link> and{" "}
              <Link href="/privacy">Privacy Policy</Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
