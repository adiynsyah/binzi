import { Skeleton } from "@/components/feedback/Loading/Skeleton";
import styles from "@/components/feedback/Loading/Skeleton.module.scss";

/**
 * Content editor loading state (TASK 058, UI/UX §35 CMS "Editor
 * loading"; CMS §44 names the Tiptap surface specifically — the
 * editor's body region is the tall block stand-in here, covering the
 * server-data half of the initialization while the client editor
 * hydrates).
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
        <Skeleton variant="block" />
      </div>
    </div>
  );
}
