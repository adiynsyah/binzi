import {
  Skeleton,
  SkeletonTable,
} from "@/components/feedback/Loading/Skeleton";
import styles from "@/components/feedback/Loading/Skeleton.module.scss";

/**
 * CMS content list loading state (TASK 058, UI/UX §35 CMS "Table
 * skeleton"). Same table shape as the course list fallback.
 */
export default function Loading() {
  return (
    <div className={styles.wrap} role="status" aria-busy="true">
      <span className={styles.srOnly}>Memuat…</span>
      <Skeleton variant="heading" />
      <SkeletonTable rows={5} columns={5} />
    </div>
  );
}
