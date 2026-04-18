"use client";

import { useState } from "react";
import Link from "next/link";
import EditArticleModal from "@/components/articles/EditArticleModal";
import type { ResearchPaper } from "@/lib/content/research";
import styles from "./page.module.css";

interface ResearchPageContentProps {
  papers: ResearchPaper[];
  isAdmin: boolean;
}

export default function ResearchPageContent({ papers, isAdmin }: ResearchPageContentProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <>
      <div className={styles.papers}>
        {papers.map((paper) => (
          <article key={paper.id} className={styles.paper} style={{ position: "relative" }}>
            {isAdmin && (
              <button
                type="button"
                className={styles.editButton}
                onClick={(e) => { e.preventDefault(); setEditingId(paper.id); }}
                aria-label="Edit"
              >
                Edit
              </button>
            )}
            <Link
              href={`/research/${paper.slug}/discussion`}
              className={styles.commentLink}
              aria-label="Open comments"
              title="Comments"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
              </svg>
            </Link>
            <div className={styles.paperMeta}>
              <span className={styles.journal}>{paper.source}</span>
              <span className={styles.year}>{paper.year}</span>
            </div>
            <h2 className={styles.paperTitle}>{paper.title}</h2>
            {paper.authors && paper.authors !== paper.source && (
              <p className={styles.paperAuthors}>{paper.authors}</p>
            )}
            {paper.summary && (
              <p className={styles.paperSummary}>{paper.summary}</p>
            )}
            <a
              href={paper.link}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.readMore}
            >
              Read analysis →
            </a>
          </article>
        ))}
      </div>
      <EditArticleModal
        articleId={editingId}
        isOpen={!!editingId}
        onClose={() => setEditingId(null)}
      />
    </>
  );
}
