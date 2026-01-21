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
