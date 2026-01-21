import {
  Article,
  Video,
  Channel,
  WellnessImage,
  TrendingTopic,
  NavItem,
  FooterSection,
} from "@/types";

export const navItems: NavItem[] = [
  { label: "Articles", href: "/articles" },
  { label: "Videos", href: "/videos" },
  { label: "Topics", href: "/topics" },
  { label: "Research", href: "/research" },
  { label: "About", href: "/about" },
];

export const articles: Article[] = [
  {
    id: "1",
    title: "The Science of Cellular Senescence: What You Need to Know",
    excerpt:
      "New research reveals how zombie cells accelerate aging and what interventions show promise in clearing them from your body.",
    category: "Cellular Health",
    author: "Dr. Sarah Chen",
    publishedAt: "2025-01-18",
    readTime: "8 min read",
    imageUrl: "/images/cellular-senescence.jpg",
    slug: "science-of-cellular-senescence",
  },
  {
    id: "2",
    title: "NAD+ Precursors: Comparing NMN, NR, and Niacin",
    excerpt:
      "A comprehensive breakdown of the different NAD+ boosting supplements, their bioavailability, and what the clinical trials actually show.",
    category: "Supplements",
    author: "Dr. Michael Torres",
    publishedAt: "2025-01-15",
    readTime: "12 min read",
    imageUrl: "/images/nad-precursors.jpg",
    slug: "nad-precursors-comparison",
  },
  {
    id: "3",
    title: "Rapamycin and mTOR: The Longevity Connection",
    excerpt:
      "Understanding how mTOR inhibition extends lifespan in animal models and the current state of human trials.",
    category: "Research",
    author: "Dr. Emily Watson",
    publishedAt: "2025-01-12",
    readTime: "10 min read",
    imageUrl: "/images/rapamycin.jpg",
    slug: "rapamycin-mtor-longevity",
  },
];

export const trendingTopics: TrendingTopic[] = [
  {
    id: "1",
    title: "Bryan Johnson's Blueprint Protocol: One Year Results Analysis",
    excerpt:
      "An in-depth look at the biological age reversal claims and what metrics actually improved over 12 months of intensive intervention.",
    category: "Protocols",
    imageUrl: "/images/blueprint-protocol.jpg",
    slug: "bryan-johnson-blueprint-results",
    isFeatured: true,
  },
  {
    id: "2",
    title: "Metformin vs. Berberine: Which Is Better for Longevity?",
    excerpt:
      "Comparing the two most popular glucose-regulating compounds used for anti-aging purposes.",
    category: "Supplements",
    imageUrl: "/images/metformin-berberine.jpg",
    slug: "metformin-vs-berberine",
  },
  {
    id: "3",
    title: "The Optimal Exercise Protocol for Longevity",
    excerpt:
      "Zone 2 cardio, HIIT, and strength training: finding the right balance for maximum healthspan.",
    category: "Fitness",
    imageUrl: "/images/exercise-longevity.jpg",
    slug: "optimal-exercise-longevity",
  },
];

export const latestVideos: Video[] = [
  {
    id: "1",
    title: "Dr. Peter Attia on the 4 Pillars of Longevity",
    thumbnailUrl: "/images/video-attia.jpg",
    channelName: "Healthspan Podcast",
    views: "1.2M views",
    publishedAt: "3 days ago",
    duration: "58:24",
    videoUrl: "https://youtube.com/watch?v=example1",
  },
  {
    id: "2",
    title: "Understanding Your Biological Age: Testing Methods Compared",
    thumbnailUrl: "/images/video-bioage.jpg",
    channelName: "Longevity Lab",
    views: "450K views",
    publishedAt: "1 week ago",
    duration: "24:15",
    videoUrl: "https://youtube.com/watch?v=example2",
  },
  {
    id: "3",
    title: "The Truth About Cold Plunges and Longevity",
    thumbnailUrl: "/images/video-cold.jpg",
    channelName: "Science of Aging",
    views: "890K views",
    publishedAt: "2 weeks ago",
    duration: "18:42",
    videoUrl: "https://youtube.com/watch?v=example3",
  },
  {
    id: "4",
    title: "Fasting Protocols: 16:8 vs OMAD vs Extended Fasts",
    thumbnailUrl: "/images/video-fasting.jpg",
    channelName: "Metabolic Health",
    views: "720K views",
    publishedAt: "2 weeks ago",
    duration: "32:18",
    videoUrl: "https://youtube.com/watch?v=example4",
  },
  {
    id: "5",
    title: "Sleep Optimization: The Foundation of Longevity",
    thumbnailUrl: "/images/video-sleep.jpg",
    channelName: "Healthspan Podcast",
    views: "560K views",
    publishedAt: "3 weeks ago",
    duration: "45:30",
    videoUrl: "https://youtube.com/watch?v=example5",
  },
];

export const topChannels: Channel[] = [
  {
    id: "1",
    name: "Dr. Peter Attia",
    description:
      "Deep dives into longevity science, metabolic health, and evidence-based medicine.",
    subscriberCount: "2.1M",
    avatarUrl: "/images/channel-attia.jpg",
    channelUrl: "https://youtube.com/@peterattia",
  },
  {
    id: "2",
    name: "Andrew Huberman",
    description:
      "Neuroscience-based tools for optimizing brain health, performance, and longevity.",
    subscriberCount: "5.8M",
    avatarUrl: "/images/channel-huberman.jpg",
    channelUrl: "https://youtube.com/@hubermanlab",
  },
  {
    id: "3",
    name: "FoundMyFitness",
    description:
      "Dr. Rhonda Patrick discusses micronutrients, genetics, and aging research.",
    subscriberCount: "1.4M",
    avatarUrl: "/images/channel-patrick.jpg",
    channelUrl: "https://youtube.com/@foundmyfitness",
  },
];

export const wellnessImages: WellnessImage[] = [
  {
    id: "1",
    title: "Morning Meditation",
    imageUrl: "/images/wellness-meditation.jpg",
    alt: "Person meditating at sunrise",
  },
  {
    id: "2",
    title: "Healthy Nutrition",
    imageUrl: "/images/wellness-nutrition.jpg",
    alt: "Colorful array of healthy foods",
  },
];

export const footerSections: FooterSection[] = [
  {
    title: "Content",
    links: [
      { label: "Articles", href: "/articles" },
      { label: "Videos", href: "/videos" },
      { label: "Research", href: "/research" },
      { label: "Podcasts", href: "/podcasts" },
    ],
  },
  {
    title: "Topics",
    links: [
      { label: "Longevity", href: "/topics/longevity" },
      { label: "Nutrition", href: "/topics/nutrition" },
      { label: "Fitness", href: "/topics/fitness" },
      { label: "Supplements", href: "/topics/supplements" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Careers", href: "/careers" },
      { label: "Press", href: "/press" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Cookie Policy", href: "/cookies" },
    ],
  },
];
