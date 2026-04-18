"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui";
import { useUserStore } from "@/store/useUserStore";
import styles from "./CommentsSection.module.css";

type ReactionValue = 1 | -1;

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  // Supabase nested select can come back as an array; we normalize when rendering.
  user: { username: string }[] | { username: string } | null;
  comment_reactions: { user_id: string; reaction: number }[];
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CommentsSection({ rssItemId }: { rssItemId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const isAdmin = useUserStore((s) => s.profile?.role === "admin");

  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [comments, setComments] = useState<CommentRow[]>([]);

  const maxLen = 1000;
  const rateLimitWindowMs = 30_000; // 30 seconds per comment per item

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const [{ data: authData }, commentsResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("comments")
        .select(
          `
          id,
          body,
          created_at,
          user_id,
          user:users!comments_user_id_fkey(username),
          comment_reactions(user_id, reaction)
        `
        )
        .eq("rss_item_id", rssItemId)
        .order("created_at", { ascending: false }),
    ]);

    setAuthUserId(authData.user?.id ?? null);

    if (commentsResult.error) {
      setError(commentsResult.error.message);
      setComments([]);
      setLoading(false);
      return;
    }

    setComments(((commentsResult.data ?? []) as unknown) as CommentRow[]);
    setLoading(false);
  }, [rssItemId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitComment() {
    setError("");
    const trimmed = body.trim();
    if (!trimmed) return;
    if (trimmed.length > maxLen) {
      setError(`Comment is too long (max ${maxLen} characters).`);
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setError("Please log in to comment.");
      return;
    }

    // Simple server-enforced rate limit: 1 comment per 30s per item per user.
    const since = new Date(Date.now() - rateLimitWindowMs).toISOString();
    const { data: recentComments, error: recentError } = await supabase
      .from("comments")
      .select("id, created_at")
      .eq("rss_item_id", rssItemId)
      .eq("user_id", authData.user.id)
      .gte("created_at", since)
      .limit(1);

    if (recentError) {
      setError(recentError.message);
      return;
    }

    if (recentComments && recentComments.length > 0) {
      setError("You’re commenting too quickly. Please wait a few seconds and try again.");
      return;
    }

    setSubmitting(true);
    const { error: insertError } = await supabase.from("comments").insert({
      rss_item_id: rssItemId,
      user_id: authData.user.id,
      body: trimmed,
    });
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setBody("");
    void load();
  }

  async function setReaction(commentId: string, reaction: ReactionValue) {
    setError("");
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) {
      setError("Please log in to react to comments.");
      return;
    }

    const current = comments.find((c) => c.id === commentId);
    const existing = current?.comment_reactions?.find((r) => r.user_id === userId);
    const existingValue = (existing?.reaction ?? 0) as number;

    if (existingValue === reaction) {
      const { error: delError } = await supabase
        .from("comment_reactions")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", userId);
      if (delError) {
        setError(delError.message);
        return;
      }
      void load();
      return;
    }

    const { error: upsertError } = await supabase.from("comment_reactions").upsert(
      {
        comment_id: commentId,
        user_id: userId,
        reaction,
      },
      { onConflict: "comment_id,user_id" }
    );

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    void load();
  }

  async function deleteComment(commentId: string, commentUserId: string) {
    setError("");
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    if (!userId) {
      setError("Please log in to delete comments.");
      return;
    }

    const canDeleteOwn = userId === commentUserId;
    if (!canDeleteOwn && !isAdmin) {
      setError("You can only delete your own comments.");
      return;
    }

    setDeletingCommentId(commentId);
    const query = supabase.from("comments").delete().eq("id", commentId);
    const { error: deleteError } = isAdmin
      ? await query
      : await query.eq("user_id", userId);
    setDeletingCommentId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    void load();
  }

  const total = comments.length;

  return (
    <section className={styles.section} aria-label="Comments">
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>Comments</h2>
          <p className={styles.hint}>
            {loading ? "Loading…" : `${total} ${total === 1 ? "comment" : "comments"}`}
          </p>
        </div>
        {!authUserId && (
          <p className={styles.hint}>
            <Link href="/login">Log in</Link> to comment and react.
          </p>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.form}>
        <textarea
          className={styles.textarea}
          placeholder={authUserId ? "Write a comment…" : "Log in to write a comment…"}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={maxLen}
          disabled={!authUserId || submitting}
        />
        <div className={styles.actionsRow}>
          <span className={styles.counter}>
            {body.length}/{maxLen}
          </span>
          <Button
            type="button"
            onClick={submitComment}
            disabled={!authUserId || submitting || !body.trim()}
          >
            {submitting ? "Posting…" : "Post comment"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className={styles.empty}>Loading comments…</div>
      ) : comments.length === 0 ? (
        <div className={styles.empty}>Be the first to comment.</div>
      ) : (
        <div className={styles.list}>
          {comments.map((c) => {
            const likes = c.comment_reactions.filter((r) => r.reaction === 1).length;
            const dislikes = c.comment_reactions.filter((r) => r.reaction === -1).length;
            const my = authUserId
              ? c.comment_reactions.find((r) => r.user_id === authUserId)?.reaction ?? 0
              : 0;

            const username =
              c.user && Array.isArray(c.user)
                ? c.user[0]?.username
                : c.user?.username;

            return (
              <article key={c.id} className={styles.comment}>
                <div className={styles.commentHeader}>
                  <span className={styles.author}>{username ?? "Member"}</span>
                  <div className={styles.commentActions}>
                    <span className={styles.timestamp}>{formatDate(c.created_at)}</span>
                    {(authUserId === c.user_id || isAdmin) && (
                      <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={() => void deleteComment(c.id, c.user_id)}
                        disabled={deletingCommentId === c.id}
                        aria-label={isAdmin ? "Delete comment (moderation)" : "Delete comment"}
                        title={isAdmin ? "Remove comment (moderation)" : undefined}
                      >
                        {deletingCommentId === c.id ? "Deleting…" : "Delete"}
                      </button>
                    )}
                  </div>
                </div>
                <p className={styles.body}>{c.body}</p>
                <div className={styles.reactionRow}>
                  <button
                    type="button"
                    className={styles.reactionButton}
                    onClick={() => setReaction(c.id, 1)}
                    data-active={my === 1}
                    aria-label="Like comment"
                  >
                    <span aria-hidden="true">👍</span>
                    <span>{likes}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.reactionButton}
                    onClick={() => setReaction(c.id, -1)}
                    data-active={my === -1}
                    aria-label="Dislike comment"
                  >
                    <span aria-hidden="true">👎</span>
                    <span>{dislikes}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

