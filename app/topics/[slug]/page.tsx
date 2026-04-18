import { notFound } from "next/navigation";
import { Header, Footer } from "@/components/layout";
import TopicPageContent from "@/components/topics/TopicPageContent";
import { getTopicConfig } from "@/lib/topics/topicConfig";
import { getTopicContentFromDB } from "@/lib/content/topics";
import { getCurrentUser } from "@/lib/auth";
import styles from "../shared.module.css";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const config = getTopicConfig(slug);

  if (!config) {
    return {
      title: "Topic Not Found | Healthspan",
    };
  }

  return {
    title: `${config.name} | Healthspan`,
    description: config.description,
  };
}

export default async function TopicPage({ params }: Props) {
  const { slug } = await params;
  const config = getTopicConfig(slug);

  if (!config) {
    notFound();
  }

  const [user, { articles, videos }] = await Promise.all([
    getCurrentUser(),
    getTopicContentFromDB(config.keywords),
  ]);
  const isAdmin = user?.role === "admin";

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <TopicPageContent
          topicName={config.name}
          topicDescription={config.description}
          topicIcon={config.icon}
          keywords={config.keywords}
          initialArticles={articles}
          initialVideos={videos}
          isAdmin={!!isAdmin}
        />
      </main>
      <Footer />
    </div>
  );
}
