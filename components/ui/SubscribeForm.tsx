"use client";

import { useState } from "react";
import Button from "./Button";
import styles from "./SubscribeForm.module.css";

interface SubscribeFormProps {
  variant?: "inline" | "stacked";
}

export default function SubscribeForm({ variant = "inline" }: SubscribeFormProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setMessage("Thanks for subscribing!");
    setEmail("");
    setIsSubmitting(false);

    setTimeout(() => setMessage(""), 3000);
  };

  return (
    <form onSubmit={handleSubmit} className={`${styles.form} ${styles[variant]}`}>
      <div className={styles.inputWrapper}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
          className={styles.input}
        />
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Subscribing..." : "Subscribe"}
      </Button>
      {message && <span className={styles.message}>{message}</span>}
    </form>
  );
}
