"use client";

import { useState } from "react";
import { ArticleCard } from "@/components/ui";
import EditArticleModal from "./EditArticleModal";
import { createClient } from "@/utils/supabase/client";
import { useUserStore } from "@/store/useUserStore";
import type { Article } from "@/types";

interface ArticlesGridWithEditProps {
  articles: Article[];
  isAdmin: boolean;
}

export default function ArticlesGridWithEdit({ articles, isAdmin }: ArticlesGridWithEditProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const supabase = createClient();
  const profile = useUserStore((s) => s.profile);

  async function handleSave(article: Article) {
    if (!profile) return;

    const { error } = await supabase.from("saved_articles").insert({
      user_id: profile.id,
      url: article.externalUrl ?? "",
      title: article.title,
      summary: article.excerpt ?? "",
      tags: [],
    });

    if (error) {
      if (error.code === "23505") {
        alert("Already saved!");
      } else {
        console.error(error);
        alert("Failed to save article.");
      }
    } else {
      setSavedIds((prev) => new Set(prev).add(article.id));
      alert("Article saved to your library!");
    }
  }

  return (
    <>
      {articles.map((article) => (
        <ArticleCard
          key={article.id}
          article={article}
          onEdit={isAdmin ? () => setEditingId(article.id) : undefined}
          onSave={profile ? () => handleSave(article) : undefined}
        />
      ))}
      <EditArticleModal
        articleId={editingId}
        isOpen={!!editingId}
        onClose={() => setEditingId(null)}
      />
    </>
  );
}