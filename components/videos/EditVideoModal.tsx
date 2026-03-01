"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  getRSSItemById,
} from "@/lib/actions/rss";
import {
  updateVideoRSSItem,
  deleteVideoRSSItem,
  resetVideoRSSItemFromFeed,
} from "@/lib/actions/videoModeration";
import type { DBRSSItem } from "@/types/database";

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};
const modalStyle: React.CSSProperties = {
  background: "var(--color-surface, #fff)",
  borderRadius: 8,
  padding: "1.5rem",
  maxWidth: 480,
  width: "90%",
  maxHeight: "90vh",
  overflow: "auto",
};
const btn = {
  primary: {
    padding: "0.5rem 1rem",
    border: "1px solid #2563eb",
    borderRadius: 6,
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 500,
  } as const,
  secondary: {
    padding: "0.5rem 1rem",
    border: "1px solid #666",
    borderRadius: 6,
    background: "#fff",
    color: "#333",
    cursor: "pointer",
    fontWeight: 500,
  } as const,
  danger: {
    padding: "0.5rem 1rem",
    border: "1px solid #b91c1c",
    borderRadius: 6,
    background: "#b91c1c",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 500,
  } as const,
};

interface EditVideoModalProps {
  videoId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (video: DBRSSItem) => void;
  onDeleted?: (videoId: string) => void;
}

export default function EditVideoModal({
  videoId,
  isOpen,
  onClose,
  onSaved,
  onDeleted,
}: EditVideoModalProps) {
  const router = useRouter();
  const [item, setItem] = useState<
    Awaited<ReturnType<typeof getRSSItemById>>["data"] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    thumbnail_url: "",
    hidden_by_admin: false,
  });
  const [message, setMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen || !videoId) {
      setItem(null);
      setMessage(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setMessage(null);
    getRSSItemById(videoId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.data) {
        setItem(res.data);
        setForm({
          title: res.data.title,
          thumbnail_url: res.data.thumbnail_url ?? "",
          hidden_by_admin: res.data.hidden_by_admin ?? false,
        });
      } else {
        setMessage({ type: "err", text: res.error ?? "Failed to load" });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, videoId]);

  async function handleSave() {
    if (!videoId) return;
    setMessage(null);
    const result = await updateVideoRSSItem(videoId, {
      title: form.title,
      thumbnail_url: form.thumbnail_url || null,
      hidden_by_admin: form.hidden_by_admin,
    });
    if (result.error) setMessage({ type: "err", text: result.error });
    else {
      setMessage({ type: "ok", text: "Saved." });
      if (result.data) {
        onSaved?.(result.data);
      }
      router.refresh();
      setTimeout(() => {
        onClose();
      }, 600);
    }
  }

  async function handleReset() {
    if (!videoId || !confirm("Refetch from RSS and revert your edits?")) return;
    setMessage(null);
    const result = await resetVideoRSSItemFromFeed(videoId);
    if (result.error) setMessage({ type: "err", text: result.error });
    else {
      setMessage({ type: "ok", text: "Reset from feed." });
      if (result.data) {
        onSaved?.(result.data);
      }
      router.refresh();
      setTimeout(() => {
        onClose();
      }, 600);
    }
  }

  async function handleDelete() {
    if (!videoId || !confirm("Delete this video from the database?")) return;
    setMessage(null);
    const result = await deleteVideoRSSItem(videoId);
    if (result.error) setMessage({ type: "err", text: result.error });
    else {
      onDeleted?.(videoId);
      router.refresh();
      onClose();
    }
  }

  if (!isOpen) return null;

  const modalContent = (
    <div
      style={overlayStyle}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Edit video"
    >
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Edit video</h3>
        {message && (
          <p
            style={{
              color: message.type === "err" ? "#b91c1c" : "#15803d",
              marginBottom: "0.75rem",
              fontSize: "0.9rem",
            }}
          >
            {message.text}
          </p>
        )}
        {loading ? (
          <p>Loading…</p>
        ) : item ? (
          <>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "0.9rem",
              }}
            >
              Title
            </label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              style={{
                width: "100%",
                padding: "0.35rem 0.5rem",
                marginBottom: "0.75rem",
                border: "1px solid #ccc",
                borderRadius: 4,
                boxSizing: "border-box",
              }}
            />
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "0.9rem",
              }}
            >
              Thumbnail URL
            </label>
            <input
              value={form.thumbnail_url}
              onChange={(e) =>
                setForm((f) => ({ ...f, thumbnail_url: e.target.value }))
              }
              style={{
                width: "100%",
                padding: "0.35rem 0.5rem",
                marginBottom: "0.75rem",
                border: "1px solid #ccc",
                borderRadius: 4,
                boxSizing: "border-box",
              }}
            />
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "1rem",
              }}
            >
              <input
                type="checkbox"
                checked={form.hidden_by_admin}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hidden_by_admin: e.target.checked }))
                }
              />
              Hidden from public
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              <button type="button" onClick={handleSave} style={btn.primary}>
                Save
              </button>
              <button type="button" onClick={handleReset} style={btn.secondary}>
                Reset from RSS
              </button>
              <button type="button" onClick={handleDelete} style={btn.danger}>
                Delete
              </button>
              <button type="button" onClick={onClose} style={btn.secondary}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button type="button" onClick={onClose} style={btn.secondary}>
            Close
          </button>
        )}
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : null;
}
