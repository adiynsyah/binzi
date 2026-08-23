import Link from "next/link";

import { Badge } from "@/components/ui/Badge/Badge";
import { Card } from "@/components/ui/Card/Card";
import { Input } from "@/components/ui/Input/Input";

import type { AssignedContentItem } from "../../queries/getLessonForEditor";
import type { AssignableContentResult } from "../../queries/searchAssignableContents";

import styles from "./LessonContentPanel.module.scss";

/**
 * Lesson editor "Content" panel (TASK 028, CMS Spec §9/§10/§11).
 *
 * Server Component — no client JavaScript required. The assigned
 * list reflects the persisted per-lesson sort_order (BR §3.2/§27);
 * reordering is TASK 029 and is only announced, never implemented
 * here. The search area is a plain GET form (shareable URL state,
 * works without JavaScript) and each available candidate row is a
 * plain <form> posting ONLY contentId to the bound
 * assignContentToLessonAction. Already-assigned Content (ANYWHERE —
 * the global UNIQUE(content_id), CMS §11/BR §25) renders a disabled
 * button plus an explanatory note instead of an action, so it is
 * visible but not selectable.
 *
 * While the course is PUBLISHED the structure is locked in V1
 * (Decisions Log #11): the search/add surface is not rendered at
 * all — the panel degrades to the read-only assigned list — and the
 * mutation independently re-checks the course status under a lock
 * server-side. Titles render as plain text; no
 * dangerouslySetInnerHTML anywhere in the panel.
 */

type ContentType = AssignedContentItem["type"];
type ContentStatus = AssignedContentItem["status"];

const TYPE_LABELS: Record<ContentType, string> = {
  ARTICLE: "Artikel",
  VIDEO: "Video",
  INFOGRAPHIC: "Infografis",
  TEXT: "Teks",
  TIP: "Tips",
};

const STATUS_LABELS: Record<ContentStatus, string> = {
  DRAFT: "Draf",
  PUBLISHED: "Terbit",
};

/** Actionable rejection messages (BR wording guidance, Indonesian). */
const ERROR_MESSAGES: Record<string, string> = {
  assigned: "Konten ini sudah ditetapkan ke pelajaran lain.",
  missing: "Konten atau pelajaran tidak ditemukan.",
  locked:
    "Kursus ini sudah terbit — isi pelajaran terkunci dan tidak dapat diubah di V1.",
  invalid: "Permintaan tidak valid. Tidak ada perubahan yang disimpan.",
};

type AssignAction = (formData: FormData) => Promise<void>;

type LessonContentPanelProps = {
  courseId: string;
  lessonId: string;
  courseStatus: "DRAFT" | "PUBLISHED";
  assigned: AssignedContentItem[];
  /** null while the course is PUBLISHED (no search surface). */
  search: AssignableContentResult | null;
  /** True when the candidate query failed (DRAFT course, DB error). */
  searchFailed?: boolean;
  searchQuery: { q?: string };
  /** URL feedback flag rendered as an actionable message. */
  error: string | undefined;
  /** assignContentToLessonAction bound to (courseId, lessonId). */
  action: AssignAction;
};

function buildSearchHref(
  base: string,
  q: string | undefined,
  page: number,
): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const queryString = params.toString();
  return queryString ? `${base}?${queryString}` : base;
}

export function LessonContentPanel({
  courseId,
  lessonId,
  courseStatus,
  assigned,
  search,
  searchFailed = false,
  searchQuery,
  error,
  action,
}: LessonContentPanelProps) {
  const isPublished = courseStatus === "PUBLISHED";
  const editorBase = `/admin/courses/${courseId}/lessons/${lessonId}`;
  const errorMessage =
    error !== undefined ? ERROR_MESSAGES[error] : undefined;
  const q = searchQuery.q;

  return (
    <section className={styles.panel} aria-labelledby="lesson-content-heading">
      <h2 className={styles.title} id="lesson-content-heading">
        Konten
      </h2>

      {errorMessage ? (
        <p className={styles.errorNotice} role="alert">
          {errorMessage}
        </p>
      ) : null}

      {assigned.length > 0 ? (
        <>
          <ol className={styles.assignedList}>
            {assigned.map((item) => (
              <li key={item.contentId} className={styles.assignedItem}>
                <span className={styles.assignedTitle}>{item.title}</span>
                <Badge tone="neutral">{TYPE_LABELS[item.type]}</Badge>
                <Badge
                  tone={item.status === "PUBLISHED" ? "success" : "warning"}
                >
                  {STATUS_LABELS[item.status]}
                </Badge>
              </li>
            ))}
          </ol>
          <p className={styles.orderNote}>
            Urutan mengikuti posisi konten yang tersimpan; penyusunan
            ulang urutan konten ditangani pada tugas berikutnya.
          </p>
        </>
      ) : (
        <Card className={styles.emptyCard}>
          <h3 className={styles.emptyTitle}>Belum ada konten.</h3>
          <p className={styles.emptyText}>
            {isPublished
              ? "Pelajaran terbit ini belum memiliki konten."
              : "Cari dan tambahkan konten pertama untuk pelajaran ini di bawah."}
          </p>
        </Card>
      )}

      {isPublished ? (
        <p className={styles.lockedNote}>
          Kursus ini sudah terbit — isi pelajaran terkunci dan tidak dapat
          ditambah atau diubah di V1.
        </p>
      ) : searchFailed ? (
        <p className={styles.lockedNote}>
          Gagal memuat pencarian konten.{" "}
          <Link className={styles.pageLink} href={buildSearchHref(editorBase, q, 1)}>
            Coba lagi
          </Link>
        </p>
      ) : (
        search && (
          <>
            <h3 className={styles.searchHeading} id="lesson-content-search-heading">
              Tambah Konten
            </h3>
            <form
              className={styles.searchForm}
              method="get"
              action={editorBase}
              aria-labelledby="lesson-content-search-heading"
            >
              <div className={styles.searchField}>
                <Input
                  type="search"
                  name="q"
                  label="Cari judul"
                  placeholder="Cari judul konten…"
                  defaultValue={q ?? ""}
                />
              </div>
              <button type="submit" className={styles.searchButton}>
                Cari
              </button>
            </form>

            <p className={styles.resultCount}>
              {q
                ? `${search.total} konten ditemukan`
                : `${search.total} konten tersedia`}
            </p>

            {search.rows.length > 0 ? (
              <ul className={styles.candidateList}>
                {search.rows.map((row) => {
                  const inThisLesson = row.assignedLessonId === lessonId;
                  const usedElsewhere =
                    row.assignedLessonId !== null && !inThisLesson;
                  return (
                    <li key={row.id} className={styles.candidateItem}>
                      <span className={styles.candidateTitle}>{row.title}</span>
                      <Badge tone="neutral">{TYPE_LABELS[row.type]}</Badge>
                      <Badge
                        tone={row.status === "PUBLISHED" ? "success" : "warning"}
                      >
                        {STATUS_LABELS[row.status]}
                      </Badge>
                      <div className={styles.candidateAction}>
                        {inThisLesson ? (
                          <button
                            type="button"
                            className={styles.assignButton}
                            disabled
                            aria-label={`Konten ${row.title} sudah ada di pelajaran ini`}
                          >
                            Sudah di pelajaran ini
                          </button>
                        ) : usedElsewhere ? (
                          <button
                            type="button"
                            className={styles.assignButton}
                            disabled
                            aria-label={`Konten ${row.title} sudah dipakai di pelajaran lain`}
                          >
                            Dipakai di pelajaran lain
                          </button>
                        ) : (
                          <form action={action}>
                            <input
                              type="hidden"
                              name="contentId"
                              value={row.id}
                            />
                            <button
                              type="submit"
                              className={styles.assignButton}
                              aria-label={`Tambahkan konten ${row.title} ke pelajaran ini`}
                            >
                              Tambahkan
                            </button>
                          </form>
                        )}
                      </div>
                      {usedElsewhere && row.assignedLessonTitle ? (
                        <span className={styles.usedInNote}>
                          Dipakai: {row.assignedLessonTitle}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Card className={styles.emptyCard}>
                <h3 className={styles.emptyTitle}>
                  Tidak ada konten yang cocok.
                </h3>
                <p className={styles.emptyText}>
                  Coba ubah kata kunci pencarian.
                </p>
              </Card>
            )}

            {search.pageCount > 1 ? (
              <nav
                className={styles.pagination}
                aria-label="Navigasi halaman pencarian konten"
              >
                {search.page > 1 ? (
                  <Link
                    className={styles.pageLink}
                    href={buildSearchHref(editorBase, q, search.page - 1)}
                  >
                    Sebelumnya
                  </Link>
                ) : (
                  <span className={styles.pageDisabled}>Sebelumnya</span>
                )}
                <p className={styles.pageStatus}>
                  Halaman {search.page} dari {search.pageCount}
                </p>
                {search.page < search.pageCount ? (
                  <Link
                    className={styles.pageLink}
                    href={buildSearchHref(editorBase, q, search.page + 1)}
                  >
                    Berikutnya
                  </Link>
                ) : (
                  <span className={styles.pageDisabled}>Berikutnya</span>
                )}
              </nav>
            ) : null}
          </>
        )
      )}
    </section>
  );
}
