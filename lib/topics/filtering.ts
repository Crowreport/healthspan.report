// Utility functions for filtering articles and videos by topic keywords

import { slugify, formatRelativeDate, extractYouTubeVideoId } from "@/lib/rss/rssFetcher";
import type { Article, Video } from "@/types";
import type { RSSSource } from "@/types/rss";

/**
 * Check if an article matches topic keywords
 * Uses strict word boundary matching to avoid false positives
 * e.g., "rem" matches "rem" but not "remember"
 * Requires keyword to appear in TITLE for single-word keywords
 */
export function articleMatchesTopic(
  title: string,
  excerpt: string,
  keywords: string[]
): boolean {
  if (keywords.length === 0) return true;

  const titleText = title.toLowerCase();
  const excerptText = excerpt.toLowerCase();

  // Article must contain at least one keyword
  return keywords.some((keyword) => {
    if (!keyword || keyword.trim().length === 0) return false;
    
    const lowerKeyword = keyword.toLowerCase().trim();
    
    // For multi-word keywords, use simple includes (more reliable for phrases)
    if (lowerKeyword.includes(" ")) {
      // Check title first (more relevant), then excerpt
      return titleText.includes(lowerKeyword) || excerptText.includes(lowerKeyword);
    }
    
    // For single-word keywords, use strict word boundary matching
    // \b is a word boundary - matches between word and non-word characters
    // This ensures "rem" matches "rem" but NOT "remember", "remission", etc.
    // Escape special regex characters first
    const escapedKeyword = lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Use word boundaries on both sides to ensure whole word match
    const wordBoundaryRegex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
    
    // Require keyword to appear in TITLE for single-word keywords
    // This prevents articles where sleep is only mentioned in passing in the excerpt
    // Title matches are more reliable indicators of article relevance
    return wordBoundaryRegex.test(titleText);
  });
}

export function mapRSSToArticles(
  sources: RSSSource[],
  keywords: string[]
): Article[] {
  const articles: Article[] = [];

  for (const source of sources) {
    // Only process article-type feeds
    if (source.source.type !== "article") continue;

    for (const item of source.articles) {
      const title = item.title || "";
      const excerpt = item.contentSnippet || "";

      // Only include articles that match topic keywords
      if (!articleMatchesTopic(title, excerpt, keywords)) {
        continue;
      }

      articles.push({
        id: item.link,
        title,
        excerpt,
        category: source.source.title,
        author: item.creator || source.source.title,
        publishedAt: item.pubDate,
        readTime: "5 min read",
        imageUrl: item.thumbnail || "/images/placeholder-article.jpg",
        slug: slugify(title),
        externalUrl: item.link,
      });
    }
  }

  // Sort by date (newest first)
  return articles.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

export function mapRSSToVideos(
  sources: RSSSource[],
  keywords: string[]
): Video[] {
  const videos: Array<Video & { pubDate: string }> = [];

  for (const source of sources) {
    // Only process video-type feeds
    if (source.source.type !== "video") continue;

    for (const item of source.articles) {
      const title = item.title || "";
      const excerpt = item.contentSnippet || "";

      // Only include videos that match topic keywords (check title)
      if (!articleMatchesTopic(title, excerpt, keywords)) {
        continue;
      }

      const videoId = extractYouTubeVideoId(item.link);
      const thumbnail =
        item.thumbnail ||
        (videoId
          ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
          : "/images/placeholder-video.jpg");

      videos.push({
        id: item.link,
        title,
        thumbnailUrl: thumbnail,
        channelName: source.source.title,
        views: "",
        publishedAt: formatRelativeDate(item.pubDate),
        pubDate: item.pubDate, // Keep original date for sorting
        duration: "",
        videoUrl: item.link,
      });
    }
  }

  // Sort by original date (newest first), then format
  return videos
    .sort(
      (a, b) =>
        new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    )
    .map(({ pubDate, ...video }) => video); // Remove pubDate before returning
}
