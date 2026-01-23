// RSS Feed Configuration Types
export interface RSSFeedConfig {
  url: string;
  type: "article" | "video" | "topic";
  image?: string;
  isTopChannel?: boolean;
  isPodcast?: boolean;
}

export interface FeedsConfig {
  feeds: RSSFeedConfig[];
}

// Parsed RSS Item Types
export interface RSSArticle {
  title: string;
  link: string;
  thumbnail?: string;
  pubDate: string;
  contentSnippet?: string;
  creator?: string;
}

// Source with its articles
export interface RSSSource {
  source: {
    title: string;
    link: string;
    image?: string;
    type: "article" | "video" | "topic";
  };
  articles: RSSArticle[];
}

// API Response Type
export interface RSSAPIResponse {
  sources: RSSSource[];
  cachedAt?: string;
  error?: string;
}
