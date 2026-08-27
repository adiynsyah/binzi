import { Skeleton } from "@/components/feedback/Loading/Skeleton";
import styles from "@/components/feedback/Loading/Skeleton.module.scss";

/**
 * Lesson editor loading state (TASK 058, UI/UX §35 CMS "Editor
 * loading"). The lesson editor loads the most assembled payload in
 * the CMS (lesson + assigned content + lesson quiz + publish checks),
 * so its loading stand-in mirrors the stacked panel shape.
 */
export default function Loading() {
  return (
    <div className={styles.wrap} role="status" aria-busy="true">
      <span className={styles.srOnly}>Memuat…</span>
      <div className={styles.stack}>
        <Skeleton variant="heading" />
        <Skeleton variant="small" />
        <Skeleton variant="block" />
        <Skeleton variant="block" />
        <Skeleton variant="block" />
        <Skeleton variant="block" />
      </div>
    </div>
  );
}
