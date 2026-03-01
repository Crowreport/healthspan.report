"use client";

import { useState } from "react";
import { VideoThumbnail } from "@/components/ui";
import EditVideoModal from "./EditVideoModal";
import type { Video } from "@/types";

interface VideosGridWithEditProps {
  videos: Video[];
  isAdmin: boolean;
}

export default function VideosGridWithEdit({
  videos,
  isAdmin,
}: VideosGridWithEditProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <>
      {videos.map((video) => (
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
      />
    </>
  );
}
