"use client";

import { useState } from "react";
import Button from "./Button";
import styles from "./SuggestionForm.module.css";

export default function SuggestionForm() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  if (submitted) {
    return (
      <div className={styles.success}>
        Thanks! We have received your feedback.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <input
        type="text"
        placeholder="Subject Title"
        className={styles.input}
        required
      />
      <textarea
        placeholder="Share your thoughts..."
        className={styles.textarea}
        required
      />
      <Button type="submit" variant="primary" fullWidth>
        Suggestions
      </Button>
    </form>
  );
}
