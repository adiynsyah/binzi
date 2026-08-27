import {
  Skeleton,
  SkeletonTable,
} from "@/components/feedback/Loading/Skeleton";
import styles from "@/components/feedback/Loading/Skeleton.module.scss";

/**
 * CMS question bank loading state (TASK 058, UI/UX §35 CMS "Table
 * skeleton"). The bank list is the slowest CMS table (ILIKE search +
 * option/usage counts), so the skeleton has real work to stand in
 * for.
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
