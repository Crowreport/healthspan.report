/**
 * Topic content from DB for TrendingTopics and topic slug pages.
 */

import { getRSSItemsByType } from "@/lib/actions/rss";
import { articleMatchesTopic } from "@/lib/topics/filtering";
import { mapRSSItemToArticle } from "@/lib/content/articles";
import { mapRSSItemToVideo } from "@/lib/content/videos";
import type { DBRSSItemWithSource } from "@/types/database";
import type { Article } from "@/types";
import type { Video } from "@/types";
import type { TrendingTopic } from "@/types";

const DEFAULT_TOPIC_PLACEHOLDER = "/images/placeholders/topic.svg";

/** Map DB topic item to TrendingTopic shape; include itemId for admin edit. */
export function mapRSSItemToTrendingTopic(item: DBRSSItemWithSource): TrendingTopic & { itemId: string } {
  const source = item.source;
  const imageUrl =
    item.thumbnail_url ||
    source?.image_url ||
    DEFAULT_TOPIC_PLACEHOLDER;

  return {
    id: item.external_url,
    itemId: item.id,
    title: item.title,
    excerpt: item.excerpt || "",
    category: source?.name || "Topic",
    imageUrl,
    slug: item.slug,
    isFeatured: false,
    externalUrl: item.external_url,
  };
}

/** Get topic items from DB for Trending Topics section (home). */
export async function getTopicItemsForTrending(limit: number = 6): Promise<{
  topics: (TrendingTopic & { itemId: string })[];
  error?: string;
}> {
  const result = await getRSSItemsByType("topic", limit);
  if (result.error) return { topics: [], error: result.error };
  const items = result.data ?? [];
  const topics = items.map(mapRSSItemToTrendingTopic);
  if (topics.length > 0) topics[0].isFeatured = true;
  return { topics };
}

/** Get topic page content from DB, filtered by topic keywords. */
export async function getTopicContentFromDB(keywords: string[]): Promise<{
  articles: Article[];
  videos: Video[];
  error?: string;
}> {
  const [articleResult, topicResult, videoResult] = await Promise.all([
    getRSSItemsByType("article", 100),
    getRSSItemsByType("topic", 100),
    getRSSItemsByType("video", 100),
  ]);
  const articleItems = articleResult.data ?? [];
  const topicItems = topicResult.data ?? [];
  const videoItems = videoResult.data ?? [];
  const allItems: DBRSSItemWithSource[] = [...articleItems, ...topicItems].sort(
    (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );

  const filteredArticles = keywords.length === 0
    ? allItems
    : allItems.filter((item) =>
        articleMatchesTopic(item.title, item.excerpt || "", keywords)
      );
  const filteredVideos = keywords.length === 0
    ? videoItems
    : videoItems.filter((item) =>
        articleMatchesTopic(item.title, item.excerpt || "", keywords)
      );

  const articles = filteredArticles.map(mapRSSItemToArticle);
  const videos = filteredVideos.map(mapRSSItemToVideo);
  return { articles, videos };
}
