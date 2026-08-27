import { Skeleton } from "@/components/feedback/Loading/Skeleton";
import styles from "@/components/feedback/Loading/Skeleton.module.scss";

/**
 * Course editor loading state (TASK 058, UI/UX §35 CMS "Editor
 * loading"; CMS §44 editor-loading discipline). Shown while the
 * editor's server payload resolves (course + lessons + quiz panels +
 * publish checks). Heading, then label/input block pairs standing in
 * for the form fields.
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
