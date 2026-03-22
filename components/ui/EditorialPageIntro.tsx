import styles from "./EditorialPageIntro.module.css";

interface EditorialPageIntroProps {
  title: string;
  description: string;
  badge?: string;
}

export default function EditorialPageIntro({
  title,
  description,
  badge,
}: EditorialPageIntroProps) {
  return (
    <section className={styles.wrapper}>
      {badge && <p className={styles.badge}>{badge}</p>}
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>{description}</p>
    </section>
  );
}
