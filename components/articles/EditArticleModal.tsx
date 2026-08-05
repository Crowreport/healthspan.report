"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { getRSSItemById, updateRSSItem, deleteRSSItem, resetRSSItemFromFeed } from "@/lib/actions/rss";

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
  primary: { padding: "0.5rem 1rem", border: "1px solid #2563eb", borderRadius: 6, background: "#2563eb", color: "#fff", cursor: "pointer", fontWeight: 500 } as const,
  secondary: { padding: "0.5rem 1rem", border: "1px solid #666", borderRadius: 6, background: "#fff", color: "#333", cursor: "pointer", fontWeight: 500 } as const,
  danger: { padding: "0.5rem 1rem", border: "1px solid #b91c1c", borderRadius: 6, background: "#b91c1c", color: "#fff", cursor: "pointer", fontWeight: 500 } as const,
};

type Label = { id: string; name: string };

interface EditArticleModalProps {
  articleId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function EditArticleModal({ articleId, isOpen, onClose }: EditArticleModalProps) {
  const router = useRouter();
  const supabase = createClient();

  const [item, setItem] = useState<Awaited<ReturnType<typeof getRSSItemById>>["data"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: "", excerpt: "", thumbnail_url: "", hidden_by_admin: false });
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Labels state
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [articleLabels, setArticleLabels] = useState<Label[]>([]);
  const [labelInput, setLabelInput] = useState("");

  useEffect(() => {
    if (!isOpen || !articleId) {
      setItem(null);
      setMessage(null);
      setArticleLabels([]);
      setLabelInput("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setMessage(null);

    async function loadAll() {
      // Load article + all labels + this article's labels in parallel
      const [articleRes, { data: labelsData }, { data: itemLabelRows }] = await Promise.all([
        getRSSItemById(articleId!),
        supabase.from("article_labels").select("id, name").order("name"),
        supabase
          .from("rss_item_labels")
          .select("label_id, article_labels(id, name)")
          .eq("rss_item_id", articleId!),
      ]);

      if (cancelled) return;
      setLoading(false);

      if (articleRes.data) {
        setItem(articleRes.data);
        setForm({
          title: articleRes.data.title,
          excerpt: articleRes.data.excerpt ?? "",
          thumbnail_url: articleRes.data.thumbnail_url ?? "",
          hidden_by_admin: articleRes.data.hidden_by_admin ?? false,
        });
      } else {
        setMessage({ type: "err", text: articleRes.error ?? "Failed to load" });
      }

      setAllLabels(labelsData ?? []);
      const attached = (itemLabelRows ?? [])
        .map((row: any) => row.article_labels)
        .filter(Boolean) as Label[];
      setArticleLabels(attached);
    }

    void loadAll();
    return () => { cancelled = true; };
  }, [isOpen, articleId]);

  // ── Label handlers ────────────────────────────────────────

  async function handleAddLabel() {
    const name = labelInput.trim();
    if (!name || !articleId) return;

    // Find or create label
    let label = allLabels.find((l) => l.name.toLowerCase() === name.toLowerCase());
    if (!label) {
      const { data, error } = await supabase
        .from("article_labels")
        .insert({ name })
        .select()
        .single();
      if (error || !data) { setMessage({ type: "err", text: "Failed to create label" }); return; }
      label = data;
      setAllLabels((prev) => [...prev, label!].sort((a, b) => a.name.localeCompare(b.name)));
    }

    // Link to article
    const { error } = await supabase
      .from("rss_item_labels")
      .insert({ rss_item_id: articleId, label_id: label!.id });

    if (!error) {
      setArticleLabels((prev) =>
        prev.find((l) => l.id === label!.id) ? prev : [...prev, label!]
      );
    }

    setLabelInput("");
  }

  async function handleRemoveLabel(labelId: string) {
    if (!articleId) return;
    await supabase
      .from("rss_item_labels")
      .delete()
      .eq("rss_item_id", articleId)
      .eq("label_id", labelId);
    setArticleLabels((prev) => prev.filter((l) => l.id !== labelId));
  }

  // ── Existing handlers ─────────────────────────────────────

  async function handleSave() {
    if (!articleId) return;
    setMessage(null);
    const result = await updateRSSItem(articleId, {
      title: form.title,
      excerpt: form.excerpt || null,
      thumbnail_url: form.thumbnail_url || null,
      hidden_by_admin: form.hidden_by_admin,
    });
    if (result.error) setMessage({ type: "err", text: result.error });
    else {
      setMessage({ type: "ok", text: "Saved." });
      router.refresh();
      setTimeout(() => { onClose(); }, 600);
    }
  }

  async function handleReset() {
    if (!articleId || !confirm("Refetch from RSS and revert your edits?")) return;
    setMessage(null);
    const result = await resetRSSItemFromFeed(articleId);
    if (result.error) setMessage({ type: "err", text: result.error });
    else {
      setMessage({ type: "ok", text: "Reset from feed." });
      router.refresh();
      setTimeout(() => { onClose(); }, 600);
    }
  }

  async function handleDelete() {
    if (!articleId || !confirm("Delete this article from the database?")) return;
    setMessage(null);
    const result = await deleteRSSItem(articleId);
    if (result.error) setMessage({ type: "err", text: result.error });
    else {
      router.refresh();
      onClose();
    }
  }

  if (!isOpen) return null;

  const modalContent = (
    <div style={overlayStyle} onClick={onClose} role="dialog" aria-modal="true" aria-label="Edit article">
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Edit article</h3>
        {message && (
          <p style={{ color: message.type === "err" ? "#b91c1c" : "#15803d", marginBottom: "0.75rem", fontSize: "0.9rem" }}>
            {message.text}
          </p>
        )}
        {loading ? (
          <p>Loading…</p>
        ) : item ? (
          <>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem" }}>Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              style={{ width: "100%", padding: "0.35rem 0.5rem", marginBottom: "0.75rem", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }}
            />
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem" }}>Excerpt</label>
            <textarea
              value={form.excerpt}
              onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
              rows={3}
              style={{ width: "100%", padding: "0.35rem 0.5rem", marginBottom: "0.75rem", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }}
            />
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem" }}>Thumbnail URL</label>
            <input
              value={form.thumbnail_url}
              onChange={(e) => setForm((f) => ({ ...f, thumbnail_url: e.target.value }))}
              style={{ width: "100%", padding: "0.35rem 0.5rem", marginBottom: "0.75rem", border: "1px solid #ccc", borderRadius: 4, boxSizing: "border-box" }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <input
                type="checkbox"
                checked={form.hidden_by_admin}
                onChange={(e) => setForm((f) => ({ ...f, hidden_by_admin: e.target.checked }))}
              />
              Hidden from public
            </label>

            {/* ── Labels section ── */}
            <div style={{ marginBottom: "1rem" }}>
              <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem", fontWeight: 500 }}>Labels</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "0.5rem" }}>
                {articleLabels.length === 0 && (
                  <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>No labels yet</span>
                )}
                {articleLabels.map((label) => (
                  <span key={label.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 10px", background: "#eff6ff", color: "#2563eb", borderRadius: 999, fontSize: "0.8rem", fontWeight: 500 }}>
                    {label.name}
                    <button
                      type="button"
                      onClick={() => void handleRemoveLabel(label.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#2563eb", fontSize: "0.9rem", lineHeight: 1, padding: 0, opacity: 0.6 }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleAddLabel(); }}
                  placeholder="Add label…"
                  list="label-suggestions"
                  style={{ flex: 1, padding: "0.35rem 0.5rem", border: "1px solid #ccc", borderRadius: 4, fontSize: "0.85rem" }}
                />
                <datalist id="label-suggestions">
                  {allLabels.map((l) => <option key={l.id} value={l.name} />)}
                </datalist>
                <button type="button" onClick={() => void handleAddLabel()} style={btn.primary}>Add</button>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              <button type="button" onClick={handleSave} style={btn.primary}>Save</button>
              <button type="button" onClick={handleReset} style={btn.secondary}>Reset from RSS</button>
              <button type="button" onClick={handleDelete} style={btn.danger}>Delete</button>
              <button type="button" onClick={onClose} style={btn.secondary}>Cancel</button>
            </div>
          </>
        ) : (
          <button type="button" onClick={onClose} style={btn.secondary}>Close</button>
        )}
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : null;
}