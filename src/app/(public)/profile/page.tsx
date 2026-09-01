import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/Card/Card";
import { getProfileSummary } from "@/features/profile/queries/getProfileSummary";
import { createClient } from "@/lib/supabase/server";

import styles from "./page.module.scss";

/**
 * BINZI Profile page (BR §7.2 "View own profile", UI/UX §32, Blueprint
 * §12 protected path).
 *
 * This closes the TASK 036 FLAG-2 gap: the auth-aware PublicHeader has
 * pointed "Profil" at /profile since TASK 036, and src/proxy.ts has
 * protected the path since TASK 013 — the route itself was never built
 * (authenticated users received the 404 page).
 *
 * Identity is resolved server-side from the validated session
 * (createClient + getUser — never client input) and rendered from the
 * authoritative `public.users` record. When that row is missing (an
 * integrity anomaly), the page falls back to the session email and the
 * email local part — the exact derivation registerAction itself uses.
 *
 * The learning summary keeps the UI/UX §32 minimal shape: "Sedang
 * Dipelajari" (Current Learning — active enrollments with the TASK 043
 * derived progress "N dari M pelajaran · P%") and "Kursus Selesai"
 * (Completed Courses). Active rows link into the learning area
 * (/courses/[slug]/learn — the TASK 042 "Lanjutkan Kursus" target);
 * completed rows link to the public course detail. A user without
 * enrollments gets the UI/UX §36 empty state with a catalog escape
 * link instead of fabricated data.
 *
 * Guests never reach this render (proxy redirect, TASK 013); the
 * in-page `redirect("/login")` is the fail-safe for any bypass.
 */
export const metadata: Metadata = {
  title: "Profil",
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeZone: "Asia/Jakarta",
});

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const summary = await getProfileSummary(user.id);

  const email = summary.user?.email ?? user.email ?? "";
  const displayName =
    summary.user?.displayName ?? (email.split("@")[0] || "Pengguna BINZI");

  const activeEnrollments = summary.enrollments.filter(
    (enrollment) => enrollment.status === "ACTIVE",
  );
  const completedEnrollments = summary.enrollments.filter(
    (enrollment) => enrollment.status === "COMPLETED",
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Profil</h1>
        <p className={styles.description}>
          Ringkasan akun dan pembelajaran Anda.
        </p>
      </header>

      <Card className={styles.identityCard}>
        <dl className={styles.identity}>
          <div className={styles.identityRow}>
            <dt className={styles.identityLabel}>Nama</dt>
            <dd className={styles.identityValue}>{displayName}</dd>
          </div>
          <div className={styles.identityRow}>
            <dt className={styles.identityLabel}>Email</dt>
            <dd className={styles.identityValue}>{email}</dd>
          </div>
        </dl>
      </Card>

      {summary.enrollments.length === 0 ? (
        <section aria-labelledby="profile-learning-heading">
          <h2 className={styles.sectionTitle} id="profile-learning-heading">
            Pembelajaran Anda
          </h2>
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>Belum ada kursus yang diikuti.</p>
            <p className={styles.emptyHint}>
              Jelajahi katalog kursus untuk mulai belajar.
            </p>
            <Link className={styles.emptyCta} href="/courses">
              Jelajahi Kursus
            </Link>
          </div>
        </section>
      ) : (
        <>
          {activeEnrollments.length > 0 ? (
            <section aria-labelledby="profile-active-heading">
              <h2 className={styles.sectionTitle} id="profile-active-heading">
                Sedang Dipelajari
              </h2>
              <ul className={styles.courseList}>
                {activeEnrollments.map((enrollment) => (
                  <li className={styles.courseRow} key={enrollment.course.slug}>
                    <Link
                      className={styles.courseTitle}
                      href={`/courses/${enrollment.course.slug}/learn`}
                    >
                      {enrollment.course.title}
                    </Link>
                    <p className={styles.courseMeta}>
                      {enrollment.completedLessonCount} dari{" "}
                      {enrollment.totalLessonCount} pelajaran ·{" "}
                      {enrollment.percent}%
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {completedEnrollments.length > 0 ? (
            <section aria-labelledby="profile-completed-heading">
              <h2
                className={styles.sectionTitle}
                id="profile-completed-heading"
              >
                Kursus Selesai
              </h2>
              <ul className={styles.courseList}>
                {completedEnrollments.map((enrollment) => (
                  <li className={styles.courseRow} key={enrollment.course.slug}>
                    <Link
                      className={styles.courseTitle}
                      href={`/courses/${enrollment.course.slug}`}
                    >
                      {enrollment.course.title}
                    </Link>
                    <p className={styles.courseMeta}>
                      Selesai{" "}
                      {enrollment.completedAt
                        ? `${dateFormatter.format(enrollment.completedAt)} WIB`
                        : "—"}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
