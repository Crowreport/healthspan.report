"use client";

import { useState } from "react";
import { ArticleCard } from "@/components/ui";
import EditArticleModal from "./EditArticleModal";
import type { Article } from "@/types";

interface ArticlesGridWithEditProps {
  articles: Article[];
  isAdmin: boolean;
}

export default function ArticlesGridWithEdit({ articles, isAdmin }: ArticlesGridWithEditProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <>
      {articles.map((article) => (
        <ArticleCard
          key={article.id}
          article={article}
          onEdit={isAdmin ? () => setEditingId(article.id) : undefined}
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
