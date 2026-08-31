import type { Metadata } from "next";
import Link from "next/link";

import buttonStyles from "@/components/ui/Button/Button.module.scss";
import { Badge } from "@/components/ui/Badge/Badge";
import { Button } from "@/components/ui/Button/Button";
import { Card } from "@/components/ui/Card/Card";
import { Input } from "@/components/ui/Input/Input";
import { courseDifficulty, publicationStatus } from "@/db/schema/enums";
import { listCourses } from "@/features/courses/queries/listCourses";
import { parseCourseListSearchParams } from "@/features/courses/schemas/course-list.schema";

import styles from "./page.module.scss";

/**
 * CMS Course List (TASK 022, CMS Spec §5).
 *
 * Server Component: all data access stays server-side behind the
 * TASK 014 proxy authorization. Search/filter state lives in the
 * URL (q / status / page) so views are shareable and the filter
 * form works as a plain GET form without JavaScript.
 *
 * Columns per CMS §5: Title, Status, Difficulty, Number of
 * Lessons, Estimated Duration, Updated At, plus the Actions
 * column carrying the Edit ("Sunting") link into the Course
 * Editor (/admin/courses/[id]/edit, TASK 024) — the same pattern
 * as the question/content lists. The remaining §5 actions
 * (Preview/Publish-Unpublish) stay deferred to their own tasks.
 * The "Create Course" CTA points at /admin/courses/new, the route
 * convention TASK 016/018 established; the create form itself is
 * TASK 023 and deliberately does not exist yet.
 */

type CourseStatus = (typeof publicationStatus.enumValues)[number];
type CourseDifficulty = (typeof courseDifficulty.enumValues)[number];

const STATUS_LABELS: Record<CourseStatus, string> = {
  DRAFT: "Draf",
  PUBLISHED: "Terbit",
};

const DIFFICULTY_LABELS: Record<CourseDifficulty, string> = {
  BEGINNER: "Pemula",
  INTERMEDIATE: "Menengah",
  ADVANCED: "Lanjutan",
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

function buildPageHref(
  query: { q?: string; status?: string },
  page: number,
): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  if (page > 1) params.set("page", String(page));
  const queryString = params.toString();
  return queryString ? `/admin/courses?${queryString}` : "/admin/courses";
}

export const metadata: Metadata = {
  title: "Kursus",
};

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseCourseListSearchParams(await searchParams);

  let result: Awaited<ReturnType<typeof listCourses>> | null = null;
  try {
    result = await listCourses(query);
  } catch (error) {
    // Detailed errors belong in server logs (CMS Spec §45);
    // users get an application-level error state.
    console.error("[admin/courses] list query failed:", error);
  }

  const isFiltered = Boolean(query.q || query.status);

  return (
    <section aria-labelledby="admin-courses-heading">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title} id="admin-courses-heading">
            Kursus
          </h1>
          <p className={styles.intro}>
            Kelola kursus pembelajaran gizi BINZI.
          </p>
        </div>
        <Link
          href="/admin/courses/new"
          className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.createCta}`}
        >
          Tambah Kursus
        </Link>
      </div>

      {result ? (
        <>
          <form
            className={styles.filters}
            method="get"
            action="/admin/courses"
          >
            <div className={styles.searchField}>
              <Input
                type="search"
                name="q"
                label="Cari judul"
                placeholder="Cari judul kursus…"
                defaultValue={query.q ?? ""}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="course-status">
                Status
              </label>
              <select
                id="course-status"
                name="status"
                className={styles.select}
                defaultValue={query.status ?? ""}
              >
                <option value="">Semua Status</option>
                {publicationStatus.enumValues.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="secondary">
              Terapkan
            </Button>
          </form>

          <p className={styles.resultCount}>
            {isFiltered
              ? `${result.total} kursus ditemukan`
              : `${result.total} kursus`}
          </p>

          {result.rows.length > 0 ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Judul</th>
                    <th scope="col">Status</th>
                    <th scope="col">Tingkat</th>
                    <th scope="col">Pelajaran</th>
                    <th scope="col">Estimasi Durasi</th>
                    <th scope="col">Diperbarui</th>
                    <th scope="col">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.id}>
                      <th scope="row" className={styles.titleCell}>
                        {row.title}
                      </th>
                      <td>
                        <Badge
                          tone={
                            row.status === "PUBLISHED" ? "success" : "warning"
                          }
                        >
                          {STATUS_LABELS[row.status as CourseStatus]}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone="neutral">
                          {DIFFICULTY_LABELS[row.difficulty as CourseDifficulty]}
                        </Badge>
                      </td>
                      <td className={styles.lessonCell}>
                        {row.lessonCount} pelajaran
                      </td>
                      <td className={styles.durationCell}>
                        {row.estimatedDuration === null
                          ? "—"
                          : `${row.estimatedDuration} menit`}
                      </td>
                      <td className={styles.dateCell}>
                        {dateFormatter.format(row.updatedAt)}
                      </td>
                      <td className={styles.actionsCell}>
                        <Link
                          className={styles.editLink}
                          href={`/admin/courses/${row.id}/edit`}
                        >
                          Sunting
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : isFiltered ? (
            <Card className={styles.panel}>
              <h2 className={styles.panelTitle}>
                Tidak ada kursus yang cocok.
              </h2>
              <p className={styles.panelText}>
                Coba ubah kata kunci atau filter pencarian.
              </p>
              <Link className={styles.panelLink} href="/admin/courses">
                Hapus filter
              </Link>
            </Card>
          ) : (
            <Card className={styles.panel}>
              <h2 className={styles.panelTitle}>Belum ada kursus.</h2>
              <p className={styles.panelText}>
                Buat kursus pertama Anda untuk mulai menyusun pembelajaran.
              </p>
            </Card>
          )}

          {result.pageCount > 1 ? (
            <nav
              className={styles.pagination}
              aria-label="Navigasi halaman kursus"
            >
              {result.page > 1 ? (
                <Link
                  className={styles.pageLink}
                  href={buildPageHref(query, result.page - 1)}
                >
                  Sebelumnya
                </Link>
              ) : (
                <span className={styles.pageDisabled}>Sebelumnya</span>
              )}
              <p className={styles.pageStatus}>
                Halaman {result.page} dari {result.pageCount}
              </p>
              {result.page < result.pageCount ? (
                <Link
                  className={styles.pageLink}
                  href={buildPageHref(query, result.page + 1)}
                >
                  Berikutnya
                </Link>
              ) : (
                <span className={styles.pageDisabled}>Berikutnya</span>
              )}
            </nav>
          ) : null}
        </>
      ) : (
        <Card className={styles.panel}>
          <h2 className={styles.panelTitle}>Gagal memuat daftar kursus.</h2>
          <p className={styles.panelText}>
            Terjadi kesalahan saat mengambil data. Silakan coba lagi.
          </p>
          <Link
            className={styles.panelLink}
            href={buildPageHref(query, query.page ?? 1)}
          >
            Coba lagi
          </Link>
        </Card>
      )}
    </section>
  );
}
