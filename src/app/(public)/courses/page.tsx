import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { courseDifficulty } from "@/db/schema/enums";
import { Badge } from "@/components/ui/Badge/Badge";
import { Button } from "@/components/ui/Button/Button";
import { Card } from "@/components/ui/Card/Card";
import { Input } from "@/components/ui/Input/Input";
import { Skeleton, SkeletonCard } from "@/components/feedback/Loading/Skeleton";
import skeletonStyles from "@/components/feedback/Loading/Skeleton.module.scss";
import { listPublishedCourses } from "@/features/courses/queries/listPublishedCourses";
import { parsePublicCourseSearchParams } from "@/features/courses/schemas/public-course-search.schema";

import styles from "./page.module.scss";

/**
 * Public Course Catalog (TASK 038, UI/UX §6 "Course Catalog", Task Plan
 * Milestone 7; route /courses is fixed by UI/UX §6 and the Blueprint §4
 * route-group map — courses/ lives under (public)).
 *
 * Structure per UI/UX §6: page title, short description, search, course
 * grid. Difficulty filtering is Task Plan "if approved" with no approval
 * recorded in the source documents, so no filter UI exists (FLAG).
 *
 * TASK 059: the §35/CMS §44 skeleton (TASK 058) moved from a segment
 * loading.tsx to in-page <Suspense> around the search + grid. The
 * catalog never calls notFound()/redirect(), so streaming it is
 * status-safe — but the segment loading.tsx (and the (public)/ one
 * above it) softened the honest 404 of /courses/[slug] below it
 * (TASK 039 contract; verified live). In-page boundaries keep the
 * skeleton scoped to this page only. The h1/description render
 * instantly; the Suspense fallback covers the search + card grid.
 *
 * Publication safety: listPublishedCourses enforces status='PUBLISHED'
 * inside the query — DRAFT courses can never render here regardless of
 * what a client sends (UI/UX §44, BR §5). Guests may browse without
 * logging in (BR §5 "Browse Course information").
 *
 * Card CTAs link to /courses/[slug], the Blueprint §12 route owned by
 * TASK 039 — the same honest-future-destination pattern approved for
 * the TASK 036 header and TASK 037 homepage cards.
 */

export const metadata: Metadata = {
  title: "Kursus",
  // TASK 063 (Blueprint §44): canonical catalog URL — search variants
  // (?q=...) resolve to the clean catalog address.
  alternates: {
    canonical: "/courses",
  },
};

const DIFFICULTY_LABELS: Record<
  (typeof courseDifficulty.enumValues)[number],
  string
> = {
  BEGINNER: "Pemula",
  INTERMEDIATE: "Menengah",
  ADVANCED: "Lanjutan",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** §35 "skeleton course cards" (TASK 058 composition) as the list fallback. */
function CatalogFallback() {
  return (
    <div className={skeletonStyles.stack} role="status" aria-busy="true">
      <span className={skeletonStyles.srOnly}>Memuat…</span>
      <Skeleton variant="block" />
      <div className={skeletonStyles.gridCards}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

async function CatalogContent({ searchParams }: PageProps) {
  const query = parsePublicCourseSearchParams(await searchParams);
  const courses = await listPublishedCourses(query);

  return (
    <>
      <form className={styles.search} action="/courses" role="search">
        <Input
          defaultValue={query.q}
          label="Cari kursus"
          name="q"
          placeholder="Judul kursus…"
          type="search"
        />
        <Button type="submit">Cari</Button>
      </form>

      {courses.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>
            {query.q
              ? "Tidak ada kursus yang ditemukan."
              : "Belum ada kursus yang tersedia."}
          </p>
          <p className={styles.emptyHint}>
            {query.q ? (
              <>
                Coba kata kunci lain atau{" "}
                <Link href="/courses">telusuri semua kursus</Link>.
              </>
            ) : (
              "Silakan kembali lagi nanti."
            )}
          </p>
        </div>
      ) : (
        <ul className={styles.grid}>
          {courses.map((course) => (
            <li key={course.id}>
              <Card className={styles.courseCard}>
                <Badge>{DIFFICULTY_LABELS[course.difficulty]}</Badge>
                <h2 className={styles.cardTitle}>
                  <Link href={`/courses/${course.slug}`}>{course.title}</Link>
                </h2>
                <p className={styles.cardDescription}>{course.description}</p>
                <p className={styles.cardMeta}>
                  {course.lessonCount} pelajaran
                  {course.estimatedDuration !== null
                    ? ` · ${course.estimatedDuration} menit`
                    : ""}
                </p>
                <Link
                  aria-label={`Lihat kursus: ${course.title}`}
                  className={styles.cardCta}
                  href={`/courses/${course.slug}`}
                >
                  Lihat Kursus
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function CoursesPage({ searchParams }: PageProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Kursus</h1>
        <p className={styles.description}>
          Telusuri kursus gizi BINZI dan mulai belajar langkah demi langkah.
        </p>
      </header>

      <Suspense fallback={<CatalogFallback />}>
        <CatalogContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
