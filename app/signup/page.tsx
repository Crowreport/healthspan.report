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
        emailRedirectTo: `${window.location.origin}/api/auth/confirm`,
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
