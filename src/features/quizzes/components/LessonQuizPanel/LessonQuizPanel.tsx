import Link from "next/link";

import { SubmitButton } from "@/components/feedback/Loading/SubmitButton";
import { Badge } from "@/components/ui/Badge/Badge";
import { Card } from "@/components/ui/Card/Card";
import { Input } from "@/components/ui/Input/Input";

import type { LessonQuizSearchQuery } from "../../schemas/lesson-quiz-search.schema";
import type {
  AssignedQuizQuestionItem,
  LessonQuizSummary,
} from "../../queries/getLessonQuizForEditor";
import type { BankQuestionResult } from "../../queries/searchBankQuestions";

import { QuizQuestionOrderList } from "./QuizQuestionOrderList";
import styles from "./LessonQuizPanel.module.scss";

/**
 * Lesson editor "Lesson Quiz" builder panel (TASK 033, CMS Spec
 * §9/§21/§23/§25).
 *
 * Server Component shell — the question search is a plain GET form
 * (shareable URL state under the panel's OWN qq/qpage params — the
 * route's q/page belong to the Content picker; both survive in one
 * URL) and each candidate row is a plain <form> posting ONLY
 * questionId to the bound addQuestionToLessonQuizAction.
 *
 * Reuse (CMS §23 — the deliberate contrast with §11 Content reuse):
 * a Question MAY sit in many Quizzes, so use elsewhere NEVER disables
 * a candidate; it is shown as information ("Digunakan di N kuis").
 * The ONLY unselectable state is "already in THIS quiz"
 * (UNIQUE(quiz_id, question_id)), rendered as a disabled affordance
 * while the mutation and the constraint remain the enforcing layers.
 *
 * While the course is DRAFT, the assigned list is rendered by the
 * QuizQuestionOrderList client component — native HTML5 drag-and-drop
 * plus the accessible Naik/Turun fallback and the Hapus membership
 * remove, all persisting through the bound actions (questionId +
 * targetPosition / questionId only; CMS §25/§26 "update the server
 * rather than relying only on local state").
 *
 * While the course is PUBLISHED the structure is locked in V1
 * (Decisions Log #11): NO ordering controls and no search/add surface
 * are rendered at all — the panel degrades to the read-only assigned
 * list — and the mutations independently re-check the course status
 * under a lock server-side.
 *
 * The "N / 10" status (CMS §21 "display something like 8 / 10
 * Questions") is display-only here: the exactly-10 rule is a
 * publication-gate check (BR §31 service layer; TASK 035), NOT a
 * builder cap — the builder never blocks adding or reordering.
 * Question text renders as plain text (never HTML).
 */

/** Actionable rejection messages (BR wording guidance, Indonesian). */
const ERROR_MESSAGES: Record<string, string> = {
  locked:
    "Kursus ini sudah terbit — isi kuis terkunci dan tidak dapat diubah di V1.",
  missing: "Soal atau kuis pelajaran tidak ditemukan.",
  duplicate: "Soal ini sudah ada di kuis pelajaran ini.",
  invalid: "Permintaan tidak valid. Tidak ada perubahan yang disimpan.",
};

type QuizAction = (formData: FormData) => Promise<void>;

type LessonQuizPanelProps = {
  courseId: string;
  lessonId: string;
  courseStatus: "DRAFT" | "PUBLISHED";
  /** The lesson's Lesson Quiz row, or null before it is materialized. */
  quiz: LessonQuizSummary | null;
  /** Assigned Questions in persisted order (CMS §25). */
  questions: AssignedQuizQuestionItem[];
  /** null while the course is PUBLISHED (no search surface). */
  search: BankQuestionResult | null;
  /** True when the candidate query failed (DRAFT course, DB error). */
  searchFailed?: boolean;
  searchQuery: LessonQuizSearchQuery;
  /** The Content picker's current q/page, preserved in this panel's links. */
  contentQuery: { q?: string; page?: number };
  /** quizError URL feedback flag rendered as an actionable message. */
  error: string | undefined;
  /** addQuestionToLessonQuizAction bound to (courseId, lessonId). */
  addAction: QuizAction;
  /** removeQuestionFromLessonQuizAction bound to (courseId, lessonId). */
  removeAction: QuizAction;
  /** reorderQuizQuestionAction bound to (courseId, lessonId). */
  reorderAction: QuizAction;
};

function buildSearchHref(
  base: string,
  qq: string | undefined,
  qpage: number,
  contentQuery: { q?: string; page?: number },
): string {
  const params = new URLSearchParams();
  // The Content picker's state rides along so paginating questions
  // never silently resets the content filter (and vice versa stays
  // TASK 028's own, untouched, behavior).
  if (contentQuery.q) params.set("q", contentQuery.q);
  if (contentQuery.page && contentQuery.page > 1) {
    params.set("page", String(contentQuery.page));
  }
  if (qq) params.set("qq", qq);
  if (qpage > 1) params.set("qpage", String(qpage));
  const queryString = params.toString();
  return queryString ? `${base}?${queryString}` : base;
}

export function LessonQuizPanel({
  courseId,
  lessonId,
  courseStatus,
  quiz,
  questions,
  search,
  searchFailed = false,
  searchQuery,
  contentQuery,
  error,
  addAction,
  removeAction,
  reorderAction,
}: LessonQuizPanelProps) {
  const isPublished = courseStatus === "PUBLISHED";
  const editorBase = `/admin/courses/${courseId}/lessons/${lessonId}`;
  const errorMessage =
    error !== undefined ? ERROR_MESSAGES[error] : undefined;
  const qq = searchQuery.qq;

  // CMS §21 status line — display only (the exactly-10 gate runs at
  // publication, TASK 035; BR §31 keeps it OUT of the database and
  // out of this builder).
  const count = questions.length;
  const remaining = 10 - count;
  const readinessNote =
    remaining > 0
      ? `Tambahkan ${remaining} soal lagi untuk memenuhi syarat penerbitan (tepat 10 soal).`
      : remaining === 0
        ? "Kuis memenuhi syarat penerbitan: tepat 10 soal."
        : "Kuis memiliki lebih dari 10 soal — publikasi pelajaran memerlukan tepat 10 soal.";

  return (
    <section className={styles.panel} aria-labelledby="lesson-quiz-heading">
      <h2 className={styles.title} id="lesson-quiz-heading">
        Kuis Pelajaran
      </h2>

      {errorMessage ? (
        <p className={styles.errorNotice} role="alert">
          {errorMessage}
        </p>
      ) : null}

      <p className={styles.status}>
        <strong className={styles.statusCount}>{count} / 10</strong> soal
      </p>
      <p className={styles.readinessNote}>{readinessNote}</p>
      {quiz ? <p className={styles.quizTitleNote}>{quiz.title}</p> : null}

      {count > 0 ? (
        isPublished ? (
          <ol className={styles.assignedList}>
            {questions.map((item) => (
              <li key={item.questionId} className={styles.assignedItem}>
                <span className={styles.assignedTitle}>
                  {item.questionText}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <>
            <QuizQuestionOrderList
              items={questions}
              reorderAction={reorderAction}
              removeAction={removeAction}
            />
            <p className={styles.orderNote}>
              Susun urutan soal dengan tarik-lepas, atau gunakan tombol
              Naik/Turun. Urutan tersimpan otomatis. Hapus hanya
              mengeluarkan soal dari kuis ini — soal tetap ada di Bank
              Soal.
            </p>
          </>
        )
      ) : (
        <Card className={styles.emptyCard}>
          <h3 className={styles.emptyTitle}>Belum ada soal.</h3>
          <p className={styles.emptyText}>
            {isPublished
              ? "Pelajaran terbit ini belum memiliki soal kuis."
              : "Cari dan tambahkan soal pertama untuk kuis ini di bawah."}
          </p>
        </Card>
      )}

      {isPublished ? (
        <p className={styles.lockedNote}>
          Kursus ini sudah terbit — isi kuis terkunci dan tidak dapat
          ditambah atau diubah di V1.
        </p>
      ) : searchFailed ? (
        <p className={styles.lockedNote}>
          Gagal memuat pencarian soal.{" "}
          <Link
            className={styles.pageLink}
            href={buildSearchHref(editorBase, qq, 1, contentQuery)}
          >
            Coba lagi
          </Link>
        </p>
      ) : (
        search && (
          <>
            <h3
              className={styles.searchHeading}
              id="lesson-quiz-search-heading"
            >
              Tambah Soal
            </h3>
            <form
              className={styles.searchForm}
              method="get"
              action={editorBase}
              aria-labelledby="lesson-quiz-search-heading"
            >
              <div className={styles.searchField}>
                <Input
                  type="search"
                  name="qq"
                  label="Cari soal"
                  placeholder="Cari teks soal…"
                  defaultValue={qq ?? ""}
                />
              </div>
              <button type="submit" className={styles.searchButton}>
                Cari
              </button>
            </form>

            <p className={styles.resultCount}>
              {qq
                ? `${search.total} soal ditemukan`
                : `${search.total} soal tersedia`}
            </p>

            {search.rows.length > 0 ? (
              <ul className={styles.candidateList}>
                {search.rows.map((row) => (
                  <li key={row.id} className={styles.candidateItem}>
                    <span className={styles.candidateTitle}>
                      {row.questionText}
                    </span>
                    <Badge tone="neutral">{row.optionCount} opsi</Badge>
                    <div className={styles.candidateAction}>
                      {row.inThisQuiz ? (
                        <button
                          type="button"
                          className={styles.addButton}
                          disabled
                          aria-label="Soal ini sudah ada di kuis ini"
                        >
                          Sudah di kuis ini
                        </button>
                      ) : (
                        <form action={addAction}>
                          <input
                            type="hidden"
                            name="questionId"
                            value={row.id}
                          />
                          <SubmitButton
                            className={styles.addButton}
                            pendingLabel="Menambahkan…"
                            aria-label="Tambahkan soal ke kuis ini"
                          >
                            Tambahkan
                          </SubmitButton>
                        </form>
                      )}
                    </div>
                    {row.usedInCount > 0 ? (
                      <span className={styles.usedInNote}>
                        Digunakan di {row.usedInCount} kuis
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <Card className={styles.emptyCard}>
                <h3 className={styles.emptyTitle}>
                  Tidak ada soal yang cocok.
                </h3>
                <p className={styles.emptyText}>
                  Coba ubah kata kunci pencarian.
                </p>
              </Card>
            )}

            {search.pageCount > 1 ? (
              <nav
                className={styles.pagination}
                aria-label="Navigasi halaman pencarian soal"
              >
                {search.page > 1 ? (
                  <Link
                    className={styles.pageLink}
                    href={buildSearchHref(
                      editorBase,
                      qq,
                      search.page - 1,
                      contentQuery,
                    )}
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
                    href={buildSearchHref(
                      editorBase,
                      qq,
                      search.page + 1,
                      contentQuery,
                    )}
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
