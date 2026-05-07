"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Header, Footer } from "@/components/layout";
import styles from "./page.module.css";

type Tag = {
  id: string;
  name: string;
};

type Folder = {
  id: string;
  name: string;
};

type SavedArticle = {
  id: string;
  title: string;
  url: string;
  source: string | null;
  summary: string | null;
  saved_at: string;
  folder_id: string | null;
  tags: Tag[];
};

export default function MyArticlesPage() {
  const [articles, setArticles] = useState<SavedArticle[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newFolderName, setNewFolderName] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);
  const [tagInputId, setTagInputId] = useState<string | null>(null);
  const [tagInputValue, setTagInputValue] = useState("");
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const [{ data: articlesData }, { data: foldersData }, { data: tagsData }] =
        await Promise.all([
          supabase
            .from("saved_articles")
            .select("id, title, url, source, summary, saved_at, folder_id")
            .order("saved_at", { ascending: false }),
          supabase.from("folders").select("id, name").order("name"),
          supabase.from("tags").select("id, name").order("name"),
        ]);

      // For each article, fetch its tags via article_tags
      const articlesWithTags: SavedArticle[] = [];
      for (const article of articlesData ?? []) {
        const { data: articleTagRows } = await supabase
          .from("article_tags")
          .select("tag_id, tags(id, name)")
          .eq("saved_article_id", article.id);

        const tags = (articleTagRows ?? [])
          .map((row: any) => row.tags)
          .filter(Boolean) as Tag[];

        articlesWithTags.push({ ...article, tags });
      }

      setArticles(articlesWithTags);
      setFolders(foldersData ?? []);
      setAllTags(tagsData ?? []);
      setLoading(false);
    }
    void load();
  }, []);

  // ── Folders ──────────────────────────────────────────────

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("folders")
      .insert({ name })
      .select()
      .single();
    if (!error && data) {
      setFolders((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewFolderName("");
      setAddingFolder(false);
    }
  }

  async function handleDeleteFolder(folderId: string) {
    await supabase.from("folders").delete().eq("id", folderId);
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    // Remove folder association from articles in state
    setArticles((prev) =>
      prev.map((a) => (a.folder_id === folderId ? { ...a, folder_id: null } : a))
    );
    if (activeFolderId === folderId) setActiveFolderId(null);
  }

  async function handleMoveToFolder(articleId: string, folderId: string | null) {
    await supabase
      .from("saved_articles")
      .update({ folder_id: folderId })
      .eq("id", articleId);
    setArticles((prev) =>
      prev.map((a) => (a.id === articleId ? { ...a, folder_id: folderId } : a))
    );
  }

  // ── Tags ─────────────────────────────────────────────────

  async function handleAddTag(articleId: string) {
    const name = tagInputValue.trim();
    if (!name) return;

    // Find or create the tag
    let tag = allTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (!tag) {
      const { data, error } = await supabase
        .from("tags")
        .insert({ name })
        .select()
        .single();
      if (error || !data) return;
      tag = data;
      setAllTags((prev) => [...prev, tag!].sort((a, b) => a.name.localeCompare(b.name)));
    }

    // Link tag to article
    const { error } = await supabase
      .from("article_tags")
      .insert({ saved_article_id: articleId, tag_id: tag!.id });

    if (!error) {
      setArticles((prev) =>
        prev.map((a) =>
          a.id === articleId && !a.tags.find((t) => t.id === tag!.id)
            ? { ...a, tags: [...a.tags, tag!] }
            : a
        )
      );
    }

    setTagInputValue("");
    setTagInputId(null);
  }

  async function handleRemoveTag(articleId: string, tagId: string) {
    await supabase
      .from("article_tags")
      .delete()
      .eq("saved_article_id", articleId)
      .eq("tag_id", tagId);
    setArticles((prev) =>
      prev.map((a) =>
        a.id === articleId ? { ...a, tags: a.tags.filter((t) => t.id !== tagId) } : a
      )
    );
  }

  // ── Remove article ────────────────────────────────────────

  async function handleUnsave(id: string) {
    await supabase.from("saved_articles").delete().eq("id", id);
    setArticles((prev) => prev.filter((a) => a.id !== id));
  }

  // ── Filtered view ─────────────────────────────────────────

  const visibleArticles = activeFolderId
    ? articles.filter((a) => a.folder_id === activeFolderId)
    : articles;

  // ── Render ────────────────────────────────────────────────

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.layout}>

          {/* Folders sidebar */}
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <h2 className={styles.sidebarTitle}>Folders</h2>
              <button
                className={styles.addFolderButton}
                onClick={() => setAddingFolder(true)}
                aria-label="New folder"
              >
                +
              </button>
            </div>

            {addingFolder && (
              <div className={styles.newFolderRow}>
                <input
                  className={styles.newFolderInput}
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleCreateFolder(); }}
                  placeholder="Folder name"
                  autoFocus
                />
                <button className={styles.newFolderConfirm} onClick={() => void handleCreateFolder()}>✓</button>
                <button className={styles.newFolderCancel} onClick={() => { setAddingFolder(false); setNewFolderName(""); }}>✕</button>
              </div>
            )}

            <ul className={styles.folderList}>
              <li>
                <button
                  className={`${styles.folderItem} ${activeFolderId === null ? styles.folderItemActive : ""}`}
                  onClick={() => setActiveFolderId(null)}
                >
                  All articles
                  <span className={styles.folderCount}>{articles.length}</span>
                </button>
              </li>
              {folders.map((folder) => (
                <li key={folder.id} className={styles.folderRow}>
                  <button
                    className={`${styles.folderItem} ${activeFolderId === folder.id ? styles.folderItemActive : ""}`}
                    onClick={() => setActiveFolderId(folder.id)}
                  >
                    {folder.name}
                    <span className={styles.folderCount}>
                      {articles.filter((a) => a.folder_id === folder.id).length}
                    </span>
                  </button>
                  <button
                    className={styles.deleteFolderButton}
                    onClick={() => void handleDeleteFolder(folder.id)}
                    aria-label={`Delete ${folder.name}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {/* Article list */}
          <div className={styles.content}>
            <h1 className={styles.heading}>
              {activeFolderId ? folders.find((f) => f.id === activeFolderId)?.name : "My Saved Articles"}
            </h1>

            {loading && <p>Loading…</p>}

            {!loading && visibleArticles.length === 0 && (
              <p className={styles.empty}>
                {activeFolderId ? "No articles in this folder." : "You haven't saved any articles yet. "}
                {!activeFolderId && <Link href="/">Browse the library</Link>}
              </p>
            )}

            <div className={styles.list}>
              {visibleArticles.map((article) => (
                <div key={article.id} className={styles.item}>
                  <div className={styles.itemContent}>
                    <a href={article.url} target="_blank" rel="noopener noreferrer" className={styles.itemTitle}>
                      {article.title}
                    </a>
                    {article.source && <p className={styles.itemSource}>{article.source}</p>}
                    {article.summary && <p className={styles.itemSummary}>{article.summary}</p>}

                    {/* Tags */}
                    <div className={styles.tagRow}>
                      {article.tags.map((tag) => (
                        <span key={tag.id} className={styles.tag}>
                          {tag.name}
                          <button
                            className={styles.tagRemove}
                            onClick={() => void handleRemoveTag(article.id, tag.id)}
                            aria-label={`Remove tag ${tag.name}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {tagInputId === article.id ? (
                        <div className={styles.tagInputRow}>
                          <input
                            className={styles.tagInput}
                            value={tagInputValue}
                            onChange={(e) => setTagInputValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") void handleAddTag(article.id); if (e.key === "Escape") { setTagInputId(null); setTagInputValue(""); } }}
                            placeholder="Tag name…"
                            autoFocus
                            list="tag-suggestions"
                          />
                          <datalist id="tag-suggestions">
                            {allTags.map((t) => <option key={t.id} value={t.name} />)}
                          </datalist>
                          <button className={styles.tagConfirm} onClick={() => void handleAddTag(article.id)}>✓</button>
                          <button className={styles.tagCancel} onClick={() => { setTagInputId(null); setTagInputValue(""); }}>✕</button>
                        </div>
                      ) : (
                        <button className={styles.addTagButton} onClick={() => setTagInputId(article.id)}>
                          + tag
                        </button>
                      )}
                    </div>

                    <div className={styles.itemFooter}>
                      <p className={styles.itemDate}>
                        Saved {new Date(article.saved_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                      {/* Move to folder */}
                      <select
                        className={styles.folderSelect}
                        value={article.folder_id ?? ""}
                        onChange={(e) => void handleMoveToFolder(article.id, e.target.value || null)}
                      >
                        <option value="">No folder</option>
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={styles.unsaveButton}
                    onClick={() => void handleUnsave(article.id)}
                    aria-label="Remove article"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}