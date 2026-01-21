import { ChannelCard, AdPlaceholder } from "@/components/ui";
import { topChannels } from "@/data/mockData";
import styles from "./TopChannels.module.css";

export default function TopChannels() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Top YouTube Channels</h2>
          <p className={styles.subtitle}>
            Follow these experts for the latest longevity research and insights
          </p>
        </div>

        <div className={styles.grid}>
          <div className={styles.channels}>
            {topChannels.map((channel) => (
              <ChannelCard key={channel.id} channel={channel} />
            ))}
          </div>

          <aside className={styles.sidebar}>
            <AdPlaceholder size="rectangle" />
          </aside>
        </div>
      </div>
    </section>
  );
}
