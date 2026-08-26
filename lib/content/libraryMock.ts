/**
 * Stand-in data for the /library page.
 *
 * `saved_items`/folders aren't built yet — see docs/saved-items-model-proposal.md,
 * still pending the Week 4 pairing session. `app/library/page.tsx` tries the real
 * `GET /api/library/saved` and `GET /api/library/folders` endpoints first and
 * falls back to this data so the page has something to render in the meantime.
 * Swap this out once those endpoints exist.
 */

export interface LibraryFolder {
  id: string;
  name: string;
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

export const mockFolders: LibraryFolder[] = [
  { id: "longevity-research", name: "Longevity Research" },
  { id: "nutrition", name: "Nutrition" },
  { id: "read-later", name: "Read Later" },
];

export const mockSavedArticles: LibrarySavedArticle[] = [
  {
    id: "mock-saved-1",
    title: "NAD+ Supplements Raise Tissue Levels in Older Adults, New Trial Confirms",
    source: "Cell Metabolism",
    teaser:
      "A randomized trial finds measurable tissue-level increases in NAD+ among adults over 60 taking daily supplementation.",
    tags: ["Longevity", "Supplements"],
    readTime: "11 min read",
    publishedAt: "2026-06-27",
    externalUrl: "#",
    folderId: "longevity-research",
  },
  {
    id: "mock-saved-2",
    title: "Resistance Training Preserves Muscle Power and Metabolism in Older Adults",
    source: "The Lancet Healthy Longevity",
    teaser:
      "A 12-month program shows resistance training maintains both strength and metabolic rate significantly better than cardio alone.",
    tags: ["Exercise", "Aging"],
    readTime: "9 min read",
    publishedAt: "2026-06-12",
    externalUrl: "#",
    folderId: "longevity-research",
  },
  {
    id: "mock-saved-3",
    title: "Fasting-Mimicking Diet Shows Promise in Human Longevity Pilot Trial",
    source: "Aging Cell",
    teaser:
      "Participants following a periodic fasting-mimicking protocol saw improved metabolic markers over a 6-month pilot.",
    tags: ["Nutrition", "Fasting"],
    readTime: "6 min read",
    publishedAt: "2026-05-30",
    externalUrl: "#",
    folderId: "nutrition",
  },
  {
    id: "mock-saved-4",
    title: "New Blood Biomarker Panel Predicts Biological Age More Accurately",
    source: "Nature Medicine",
    teaser:
      "Researchers validate a nine-marker blood panel that outperforms existing biological age clocks in a large cohort.",
    tags: ["Biomarkers"],
    readTime: "5 min read",
    publishedAt: "2026-05-18",
    externalUrl: "#",
    folderId: null,
  },
];

export const mockSavedVideos: LibrarySavedVideo[] = [
  {
    id: "mock-video-1",
    title: "NAD+ and Longevity — What the Science Shows",
    channelName: "Peter Attia MD",
    duration: "18:24",
    tags: ["Longevity", "NAD+"],
    videoUrl: "#",
    folderId: "longevity-research",
  },
  {
    id: "mock-video-2",
    title: "How Sleep Deprivation Ages Your Brain",
    channelName: "Huberman Lab",
    duration: "16:10",
    tags: ["Sleep", "Brain Health"],
    videoUrl: "#",
    folderId: "read-later",
  },
  {
    id: "mock-video-3",
    title: "Omega-3s: Dosage, Benefits & Evidence",
    channelName: "FoundMyFitness",
    duration: "14:32",
    tags: ["Omega-3", "Nutrition"],
    videoUrl: "#",
    folderId: "nutrition",
  },
];
