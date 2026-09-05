/**
 * Shared shapes for the /library page, mapped from the real
 * `GET /api/library/saved` / `GET /api/library/folders` responses in
 * `app/library/page.tsx` — see docs/library-api.md for the backend contract.
 */

export interface LibraryFolder {
  id: string;
  name: string;
  /** From the server's `item_count`. */
  itemCount?: number;
}

export interface LibrarySavedArticle {
  /** rss_items.id — feeds ReactionBar/CommentBubble, which hit the real API. */
  id: string;
  title: string;
  source: string;
  teaser: string;
  tags: string[];
  imageUrl?: string;
  readTime: string;
  publishedAt: string;
  externalUrl: string;
  folderId: string | null;
}

export interface LibrarySavedVideo {
  id: string;
  title: string;
  channelName: string;
  duration: string;
  tags: string[];
  thumbnailUrl?: string;
  videoUrl: string;
  folderId: string | null;
}
