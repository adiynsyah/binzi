import Link from "next/link";

import { SubmitButton } from "@/components/feedback/Loading/SubmitButton";
import { Badge } from "@/components/ui/Badge/Badge";
import { Card } from "@/components/ui/Card/Card";
import { Input } from "@/components/ui/Input/Input";

import type { LessonQuizSearchQuery } from "../../schemas/lesson-quiz-search.schema";
import type {
  AssignedQuizQuestionItem,
} from "../../queries/getLessonQuizForEditor";
import type { FinalQuizSummary } from "../../queries/getFinalQuizForEditor";
import type { BankQuestionResult } from "../../queries/searchBankQuestions";

import { QuizQuestionOrderList } from "../LessonQuizPanel/QuizQuestionOrderList";
import styles from "./FinalQuizPanel.module.scss";

/**
 * Course Builder "Final Quiz" builder panel (TASK 034, CMS Spec
 * §7/§20/§23/§25; BR §16; Blueprint §27).
 *
 * Server Component shell — the question search is a plain GET form
 * (shareable URL state under the panel's OWN fq/fqpage params,
 * namespaced per the TASK 034 URL contract so it can never collide
 * with another route's or panel's filter state) and each candidate
 * row is a plain <form> posting ONLY questionId to the bound
 * addQuestionToFinalQuizAction.
 *
 * Reuse (CMS §23 — the deliberate contrast with §11 Content reuse):
 * a Question MAY sit in many Quizzes — including a Lesson Quiz AND
 * this Final Quiz at once — so use elsewhere NEVER disables a
 * candidate; it is shown as information ("Digunakan di N kuis").
 * The ONLY unselectable state is "already in THIS quiz"
 * (UNIQUE(quiz_id, question_id)), rendered as a disabled affordance
 * while the mutation and the constraint remain the enforcing layers.
 *
 * While the course is DRAFT, the assigned list is rendered by the
 * QuizQuestionOrderList client component (TASK 033, reused verbatim
 * — its action props are quiz-agnostic) — native HTML5 drag-and-drop
 * plus the accessible Naik/Turun fallback and the Hapus membership
 * remove, all persisting through the bound actions (questionId +
 * targetPosition / questionId only; CMS §25/§26 "update the server
 * rather than relying only on local state").
 *
 * While the course is PUBLISHED the structure is locked in V1
 * (Decisions Log #11): NO ordering controls and no search/add
 * surface are rendered at all — the panel degrades to the read-only
 * assigned list — and the mutations independently re-check the
 * course status under a lock server-side.
 *
 * The count-vs-range status (CMS §20 Min 10 / Max 30) is
 * display-only here: the 10–30 rule is a publication-gate check
 * (BR §16 service layer; TASK 035), NOT a builder cap — the builder
 * never blocks adding or reordering. Question text renders as plain
 * text (never HTML).
 */

/** Actionable rejection messages (BR wording guidance, Indonesian). */
const ERROR_MESSAGES: Record<string, string> = {
  locked:
    "Kursus ini sudah terbit — isi kuis terkunci dan tidak dapat diubah di V1.",
  missing: "Soal atau kuis akhir tidak ditemukan.",
  duplicate: "Soal ini sudah ada di kuis akhir ini.",
  invalid: "Permintaan tidak valid. Tidak ada perubahan yang disimpan.",
};

type QuizAction = (formData: FormData) => Promise<void>;

type FinalQuizPanelProps = {
  courseId: string;
  courseStatus: "DRAFT" | "PUBLISHED";
  /** The course's Final Quiz row, or null before it is materialized. */
  quiz: FinalQuizSummary | null;
  /** Assigned Questions in persisted order (CMS §25). */
  questions: AssignedQuizQuestionItem[];
  /** null while the course is PUBLISHED (no search surface). */
  search: BankQuestionResult | null;
  /** True when the candidate query failed (DRAFT course, DB error). */
  searchFailed?: boolean;
  /** Normalized fq/fqpage URL state (qq/qpage field names). */
  searchQuery: LessonQuizSearchQuery;
  /** finalQuizError URL feedback flag rendered as an actionable message. */
  error: string | undefined;
  /** addQuestionToFinalQuizAction bound to (courseId). */
  addAction: QuizAction;
  /** removeQuestionFromFinalQuizAction bound to (courseId). */
  removeAction: QuizAction;
  /** reorderFinalQuizQuestionAction bound to (courseId). */
  reorderAction: QuizAction;
};

function buildSearchHref(base: string, fq: string | undefined, fqpage: number) {
  const params = new URLSearchParams();
  if (fq) params.set("fq", fq);
  if (fqpage > 1) params.set("fqpage", String(fqpage));
  const queryString = params.toString();
  return queryString ? `${base}?${queryString}` : base;
}

export function FinalQuizPanel({
  courseId,
  courseStatus,
  quiz,
  questions,
  search,
  searchFailed = false,
  searchQuery,
  error,
  addAction,
  removeAction,
  reorderAction,
}: FinalQuizPanelProps) {
  const isPublished = courseStatus === "PUBLISHED";
  const builderBase = `/admin/courses/${courseId}/edit`;
  const errorMessage =
    error !== undefined ? ERROR_MESSAGES[error] : undefined;
  const fq = searchQuery.qq;

  // CMS §20 status line — display only (the 10–30 publication gate
  // runs at publish validation, TASK 035; BR §16 keeps it OUT of the
  // database and out of this builder).
  const count = questions.length;
  const readinessNote =
    count < 10
      ? `Tambahkan ${10 - count} soal lagi untuk memenuhi syarat minimal penerbitan (rentang 10–30 soal).`
      : count <= 30
        ? "Kuis memenuhi syarat penerbitan: jumlah soal berada dalam rentang 10–30."
        : "Kuis memiliki lebih dari 30 soal — publikasi kursus memerlukan rentang 10–30 soal.";

  return (
    <section
      className={styles.panel}
      aria-labelledby="course-builder-final-quiz-heading"
    >
      <h2 className={styles.title} id="course-builder-final-quiz-heading">
        Kuis Akhir
      </h2>

      {errorMessage ? (
        <p className={styles.errorNotice} role="alert">
          {errorMessage}
        </p>
      ) : null}

      <p className={styles.status}>
        <strong className={styles.statusCount}>{count}</strong> soal dari
        rentang 10–30
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
              ? "Kursus terbit ini belum memiliki soal kuis akhir."
              : "Cari dan tambahkan soal pertama untuk kuis akhir ini di bawah."}
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
            href={buildSearchHref(builderBase, fq, 1)}
          >
            Coba lagi
          </Link>
        </p>
      ) : (
        search && (
          <>
            <h3
              className={styles.searchHeading}
              id="course-builder-final-quiz-search-heading"
            >
              Tambah Soal
            </h3>
            <form
              className={styles.searchForm}
              method="get"
              action={builderBase}
              aria-labelledby="course-builder-final-quiz-search-heading"
            >
              <div className={styles.searchField}>
                <Input
                  type="search"
                  name="fq"
                  label="Cari soal"
                  placeholder="Cari teks soal…"
                  defaultValue={fq ?? ""}
                />
              </div>
              <button type="submit" className={styles.searchButton}>
                Cari
              </button>
            </form>

            <p className={styles.resultCount}>
              {fq
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
                            aria-label="Tambahkan soal ke kuis akhir ini"
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
                aria-label="Navigasi halaman pencarian soal kuis akhir"
              >
                {search.page > 1 ? (
                  <Link
                    className={styles.pageLink}
                    href={buildSearchHref(builderBase, fq, search.page - 1)}
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
                    href={buildSearchHref(builderBase, fq, search.page + 1)}
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
