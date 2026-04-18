/**
 * Modular content layer: videos from DB (rss_items with content_type=video).
 * Used by Videos page with rss_items moderation.
 */

import { getRSSItemsByType } from "@/lib/actions/rss";
import { formatRelativeDate } from "@/lib/rss/rssFetcher";
import type { DBRSSItemWithSource } from "@/types/database";
import type { Video } from "@/types";

const DEFAULT_VIDEO_PLACEHOLDER = "/images/placeholders/video.svg";

export function mapRSSItemToVideo(item: DBRSSItemWithSource): Video {
  const source = item.source;
  const fallbackYouTubeThumb = item.youtube_video_id
    ? `https://img.youtube.com/vi/${item.youtube_video_id}/hqdefault.jpg`
    : null;

  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    thumbnailUrl:
      item.thumbnail_url ||
      fallbackYouTubeThumb ||
      source?.image_url ||
      DEFAULT_VIDEO_PLACEHOLDER,
    channelName: item.youtube_channel_name || source?.name || "",
    views: item.view_count || "",
    publishedAt: formatRelativeDate(item.published_at),
    duration: item.duration || "",
    videoUrl: item.external_url,
  };
}

export async function getVideosFromDB(limit?: number): Promise<{
  videos: Video[];
  error?: string;
}> {
  const result = await getRSSItemsByType("video", limit ?? 100);
  if (result.error) {
    return { videos: [], error: result.error };
  }

  const items = result.data ?? [];
  const videos = items.map(mapRSSItemToVideo);
  return { videos };
}
