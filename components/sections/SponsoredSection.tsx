"use client";

import { useEffect, useState } from "react";
import type { DBSponsor } from "@/types/database";
import styles from "./SponsoredSection.module.css";

function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = "/images/placeholders/article.svg";
}

interface SponsorsResponse {
  sponsors: DBSponsor[];
}

/**
 * Sponsored homepage placements — style guide 3.4. Pulls real rows from
 * GET /api/sponsors (migration 021); renders nothing until there's at least
 * one active sponsor, rather than showing a placeholder ad.
 */
export default function SponsoredSection() {
  const [sponsors, setSponsors] = useState<DBSponsor[]>([]);

  useEffect(() => {
    let isCancelled = false;

    fetch("/api/sponsors")
      .then((response) => (response.ok ? (response.json() as Promise<SponsorsResponse>) : null))
      .then((payload) => {
        if (!isCancelled && payload) {
          setSponsors(payload.sponsors);
        }
      })
      .catch((error) => console.error("Sponsors fetch failed:", error));

    return () => {
      isCancelled = true;
    };
  }, []);

  if (sponsors.length === 0) return null;

  return (
    <div className={styles.stack}>
      {sponsors.map((sponsor) => (
        <a
          key={sponsor.id}
          href={sponsor.cta_url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className={styles.card}
        >
          <div className={styles.content}>
            <span className={styles.name}>{sponsor.name}</span>
            <h3 className={styles.headline}>{sponsor.headline}</h3>
            <p className={styles.description}>{sponsor.description}</p>
            <span className={styles.cta}>{sponsor.cta_label}</span>
            <p className={styles.disclosure}>{sponsor.disclosure}</p>
          </div>

          <div className={styles.imageWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sponsor.image_url || "/images/placeholders/article.svg"}
              alt=""
              className={styles.image}
              loading="lazy"
              onError={handleImageError}
            />
            <span className={styles.badge}>Sponsored</span>
          </div>
        </a>
      ))}
    </div>
  );
}
