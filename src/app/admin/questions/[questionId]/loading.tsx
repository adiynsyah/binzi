import { Skeleton } from "@/components/feedback/Loading/Skeleton";
import styles from "@/components/feedback/Loading/Skeleton.module.scss";

/**
 * Question editor loading state (TASK 058, UI/UX §35 CMS "Editor
 * loading"). Stands in while the question, its options, and the
 * quiz-usage section resolve.
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
      </div>
    </div>
  );
}
