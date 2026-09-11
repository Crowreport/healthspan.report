import type { TopChannel } from "@/app/page";
import styles from "./TopChannelsSection.module.css";

interface TopChannelsSectionProps {
  channels: TopChannel[];
}

function handleAvatarError(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = "/images/placeholders/video.svg";
}

/**
 * Real channel name + real avatar (rss_sources.image_url). Subscriber count
 * is fabricated — see TopChannel.fakeSubscriberCount's doc comment in
 * app/page.tsx. "Follow" is disabled: there's no follow/subscription
 * feature built, so it stays visually present but honestly inert.
 */
export default function TopChannelsSection({ channels }: TopChannelsSectionProps) {
  if (channels.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Top YouTube Channels</h2>

      <div className={styles.row}>
        {channels.map((channel) => (
          <div key={channel.id} className={styles.channel}>
            <a href={channel.href} target="_blank" rel="noopener noreferrer" className={styles.avatarLink}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={channel.avatarUrl || "/images/placeholders/video.svg"}
                alt={channel.name}
                className={styles.avatar}
                loading="lazy"
                onError={handleAvatarError}
              />
            </a>
            <div className={styles.body}>
              <a href={channel.href} target="_blank" rel="noopener noreferrer" className={styles.nameLink}>
                {channel.name}
              </a>
              <span className={styles.count}>{channel.fakeSubscriberCount}</span>
              <button type="button" className={styles.followButton} disabled title="Following isn't available yet">
                Follow
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
