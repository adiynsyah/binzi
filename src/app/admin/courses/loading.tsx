import {
  Skeleton,
  SkeletonTable,
} from "@/components/feedback/Loading/Skeleton";
import styles from "@/components/feedback/Loading/Skeleton.module.scss";

/**
 * CMS course list loading state (TASK 058, UI/UX §35 CMS "Table
 * skeleton"; CMS §44 "Skeleton for page/list loading"). Five rows of
 * five generic cells under a header row — column-count-agnostic by
 * design.
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
