"use client";

import { useState } from "react";
import type { LibraryFolder } from "@/lib/content/libraryMock";
import styles from "./FoldersSidebar.module.css";

interface FoldersSidebarProps {
  folders: LibraryFolder[];
  /** Folder id currently filtering the list, or null for "All saved". */
  activeFolderId: string | null;
  countsByFolder: Record<string, number>;
  totalCount: number;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder: (name: string) => void;
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

function AllIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

/** Cycles a folder id through a few existing theme tokens for visual variety. */
const ICON_TONES = ["primary", "accent", "warning", "success"] as const;
function toneFor(id: string): (typeof ICON_TONES)[number] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % ICON_TONES.length;
  return ICON_TONES[hash];
}

export default function FoldersSidebar({
  folders,
  activeFolderId,
  countsByFolder,
  totalCount,
  onSelectFolder,
  onCreateFolder,
}: FoldersSidebarProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  function submitNewFolder(event: React.FormEvent) {
    event.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    onCreateFolder(name);
    setNewFolderName("");
    setIsCreating(false);
  }

  return (
    <aside className={styles.sidebar} aria-label="Folders">
      <span className={styles.sectionLabel}>My Library</span>

      <div className={styles.folderList}>
        <button
          type="button"
          className={`${styles.folderCard} ${activeFolderId === null ? styles.active : ""}`}
          onClick={() => onSelectFolder(null)}
        >
          <span className={`${styles.iconChip} ${styles.primary}`}>
            <AllIcon />
          </span>
          <span className={styles.folderName}>All Saved</span>
          <span className={styles.count}>{totalCount}</span>
        </button>

        {folders.map((folder) => (
          <button
            key={folder.id}
            type="button"
            className={`${styles.folderCard} ${activeFolderId === folder.id ? styles.active : ""}`}
            onClick={() => onSelectFolder(folder.id)}
          >
            <span className={`${styles.iconChip} ${styles[toneFor(folder.id)]}`}>
              <FolderIcon />
            </span>
            <span className={styles.folderName}>{folder.name}</span>
            <span className={styles.count}>{countsByFolder[folder.id] ?? 0}</span>
          </button>
        ))}
      </div>

      {isCreating ? (
        <form className={styles.newFolderForm} onSubmit={submitNewFolder}>
          <input
            autoFocus
            className={styles.newFolderInput}
            placeholder="Folder name"
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            onBlur={() => {
              if (!newFolderName.trim()) setIsCreating(false);
            }}
          />
          <button type="submit" className={styles.newFolderSubmit} aria-label="Create folder">
            Add
          </button>
        </form>
      ) : (
        <button type="button" className={styles.newFolderButton} onClick={() => setIsCreating(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Folder
        </button>
      )}
    </aside>
  );
}
