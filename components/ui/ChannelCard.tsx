import { Channel } from "@/types";
import styles from "./ChannelCard.module.css";

interface ChannelCardProps {
  channel: Channel;
}

export default function ChannelCard({ channel }: ChannelCardProps) {
  const hasAvatar =
    channel.avatarUrl && !channel.avatarUrl.includes("placeholder");

  return (
    <a
      href={channel.channelUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.card}
    >
      <div className={styles.avatar}>
        {hasAvatar ? (
          <img
            src={channel.avatarUrl}
            alt={channel.name}
            className={styles.avatarImage}
          />
        ) : (
          <div
            className={styles.avatarPlaceholder}
            style={{
              background: `linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)`,
            }}
          >
            <span className={styles.initial}>{channel.name.charAt(0)}</span>
          </div>
        )}
      </div>

      <div className={styles.content}>
        <h4 className={styles.name}>{channel.name}</h4>
        <p className={styles.description}>{channel.description}</p>
        <span className={styles.subscribers}>
          {channel.subscriberCount} subscribers
        </span>
      </div>

      <div className={styles.playIcon}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z" />
        </svg>
      </div>
    </a>
  );
}
