"use client";

import { useEffect, useState } from "react";
import { VideoThumbnail } from "@/components/ui";
import EditVideoModal from "./EditVideoModal";
import { extractYouTubeVideoId } from "@/lib/rss/rssFetcher";
import type { Video } from "@/types";
import type { DBRSSItem } from "@/types/database";

interface VideosGridWithEditProps {
  videos: Video[];
  isAdmin: boolean;
}

export default function VideosGridWithEdit({
  videos,
  isAdmin,
}: VideosGridWithEditProps) {
  const [displayVideos, setDisplayVideos] = useState<Video[]>(videos);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setDisplayVideos(videos);
  }, [videos]);

  function resolveThumbnail(nextItem: DBRSSItem, currentVideo: Video): string {
    if (nextItem.thumbnail_url) return nextItem.thumbnail_url;

    const videoId = nextItem.youtube_video_id || extractYouTubeVideoId(nextItem.external_url);
    if (videoId) {
      return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }

    return currentVideo.thumbnailUrl || "/images/placeholders/video.svg";
  }

  function handleVideoSaved(nextItem: DBRSSItem) {
    setDisplayVideos((prev) =>
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
    setDisplayVideos((prev) => prev.filter((video) => video.id !== videoId));
  }

  return (
    <>
      {displayVideos.map((video) => (
        <VideoThumbnail
          key={video.id}
          video={video}
          onEdit={isAdmin ? () => setEditingId(video.id) : undefined}
        />
      ))}
      <EditVideoModal
        videoId={editingId}
        isOpen={!!editingId}
        onClose={() => setEditingId(null)}
        onSaved={handleVideoSaved}
        onDeleted={handleVideoDeleted}
      />
    </>
  );
}
