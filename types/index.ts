export interface Article {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  publishedAt: string;
  readTime: string;
  imageUrl: string;
  slug: string;
  externalUrl?: string; // Link to original article (for RSS-sourced content)
  sourceName?: string;
  evidenceLevel?: "High" | "Moderate" | "Emerging";
}

export interface Video {
  id: string;
  title: string;
  thumbnailUrl: string;
  channelName: string;
  views: string;
  publishedAt: string;
  duration: string;
  videoUrl: string;
  contentLabel?: string;
}

export interface Podcast {
  id: string;
  name: string;
  description: string;
  publisher: string;
  publishedAt: string;
  duration: string;
  imageUrl: string;
  podcastUrl: string;
  views: string;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  subscriberCount: string;
  avatarUrl: string;
  channelUrl: string;
}

export interface WellnessImage {
  id: string;
  title: string;
  imageUrl: string;
  alt: string;
}

export interface TrendingTopic {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  imageUrl: string;
  slug: string;
  isFeatured?: boolean;
  externalUrl?: string; // Link to original article (for RSS-sourced content)
}

export interface NavItem {
  label: string;
  href: string;
}

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterSection {
  title: string;
  links: FooterLink[];
}
