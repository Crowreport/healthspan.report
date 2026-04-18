"use client";

import { useState, useEffect } from "react";
import { VideoThumbnail, Carousel } from "@/components/ui";
import { latestVideos as mockVideos } from "@/data/mockData";
import EditVideoModal from "@/components/videos/EditVideoModal";
import {
  formatRelativeDate,
  extractYouTubeVideoId,
  slugify,
} from "@/lib/rss/rssFetcher";
import type { Video } from "@/types";
import type { DBRSSItem } from "@/types/database";
import type { RSSAPIResponse, RSSSource } from "@/types/rss";
import styles from "./LatestVideos.module.css";

function mapRSSToVideos(sources: RSSSource[]): Video[] {
  const videos: Video[] = [];

  for (const source of sources) {
    for (const item of source.articles) {
      const videoId = extractYouTubeVideoId(item.link);
      // Priority: item thumbnail > generated YouTube thumbnail > source image > placeholder
      const thumbnail =
        item.thumbnail ||
        (videoId
          ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
          : source.source.image || "/images/placeholders/video.svg");

      videos.push({
        id: item.link,
        title: item.title,
        slug: slugify(item.title),
        thumbnailUrl: thumbnail,
        channelName: source.source.title,
        views: "", // Not available from RSS
        publishedAt: formatRelativeDate(item.pubDate),
        duration: "", // Not available from RSS
        videoUrl: item.link,
      });
    }
  }

  // Sort by date - return all videos for carousel
  return videos.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

interface LatestVideosProps {
  initialVideos?: Video[];
  isAdmin?: boolean;
}

export default function LatestVideos({
  initialVideos = [],
  isAdmin = false,
}: LatestVideosProps) {
  const [videos, setVideos] = useState<Video[]>(
    initialVideos.length > 0 ? initialVideos : mockVideos
  );
  const [isLoading, setIsLoading] = useState(initialVideos.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (initialVideos.length > 0) {
      setVideos(initialVideos);
    }
  }, [initialVideos]);

  useEffect(() => {
    if (initialVideos.length > 0 || isAdmin) {
      setIsLoading(false);
      return;
    }

    async function fetchVideos() {
      try {
        const response = await fetch("/api/rss?type=video");
        if (!response.ok) throw new Error("Failed to fetch videos");

        const data: RSSAPIResponse = await response.json();
        const mappedVideos = mapRSSToVideos(data.sources);

        if (mappedVideos.length > 0) {
          setVideos(mappedVideos);
        }
      } catch (err) {
        console.error("Failed to fetch RSS videos:", err);
        // Keep mock data on error
      } finally {
        setIsLoading(false);
      }
    }

    fetchVideos();
  }, [initialVideos.length, isAdmin]);

  function resolveThumbnail(nextItem: DBRSSItem, currentVideo: Video): string {
    if (nextItem.thumbnail_url) return nextItem.thumbnail_url;

    const videoId =
      nextItem.youtube_video_id || extractYouTubeVideoId(nextItem.external_url);
    if (videoId) {
      return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }

    return currentVideo.thumbnailUrl || "/images/placeholders/video.svg";
  }

  function handleVideoSaved(nextItem: DBRSSItem) {
    setVideos((prev) =>
      prev.map((video) => {
        if (video.id !== nextItem.id) return video;
        return {
          ...video,
          title: nextItem.title,
          thumbnailUrl: resolveThumbnail(nextItem, video),
        };
      })
    );
  }

  function handleVideoDeleted(videoId: string) {
    setVideos((prev) => prev.filter((video) => video.id !== videoId));
  }

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <span className={styles.icon}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z" />
              </svg>
            </span>
            <h2 className={styles.title}>Latest Videos</h2>
          </div>
          <a href="/videos" className={styles.viewAll}>
            View all videos
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        {isLoading ? (
          <div className={styles.skeletonGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.skeleton}>
                <div className={styles.skeletonImage} />
                <div className={styles.skeletonContent}>
                  <div className={styles.skeletonTitle} />
                  <div className={styles.skeletonMeta} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <Carousel>
              {videos.map((video) => (
                <VideoThumbnail
                  key={video.id}
                  video={video}
                  onEdit={isAdmin ? () => setEditingId(video.id) : undefined}
                />
              ))}
            </Carousel>
            <EditVideoModal
              videoId={editingId}
              isOpen={!!editingId}
              onClose={() => setEditingId(null)}
              onSaved={handleVideoSaved}
              onDeleted={handleVideoDeleted}
            />
          </>
        )}
      </div>
    </section>
  );
}
