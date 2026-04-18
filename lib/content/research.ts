/**
 * Research papers from DB for the Research page.
 */

import { getRSSItemsByType } from "@/lib/actions/rss";
import type { DBRSSItemWithSource } from "@/types/database";

export interface ResearchPaper {
  id: string;
  title: string;
  authors: string;
  source: string;
  publishedAt: string;
  year: string;
  summary: string;
  link: string;
  slug: string;
  categories?: string[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function mapItemToResearchPaper(item: DBRSSItemWithSource): ResearchPaper {
  const date = new Date(item.published_at);
  return {
    id: item.id,
    title: item.title,
    authors: item.author || item.source?.name || "",
    source: item.source?.name || "Unknown",
    publishedAt: item.published_at,
    year: isNaN(date.getTime()) ? "" : date.getFullYear().toString(),
    summary: item.excerpt || "",
    link: item.external_url,
    slug: item.slug,
  };
}

/** Get research/topic items from DB for Research page. Uses topic sources (Lifespan.io, Fight Aging!, etc.). */
export async function getResearchPapersFromDB(limit: number = 80): Promise<{
  papers: ResearchPaper[];
  error?: string;
}> {
  const result = await getRSSItemsByType("topic", limit);
  if (result.error) return { papers: [], error: result.error };
  const items = result.data ?? [];
  const papers = items
    .map(mapItemToResearchPaper)
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  return { papers };
}
