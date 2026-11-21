// MyGrades (card S5-03 §4) — every state of /belajar/nilai in ONE server
// component (no "use client": pure render over GradesPageDTO). The empty
// state (8f) is built inline, NOT via EmptyState (that component is "use
// client", demands two actions, and heads with an h3 — card decision 10).
//
// Numbers come straight from the DTO — never recomputed here (decision 2).
// Weights in copy are the LIVE ones from system_settings, the same source
// the Final result screen shows (decision 7). No value is imported from a
// "use client" module; reviewReveals (server component quiz-result.tsx)
// only names the review-link states.
//
// Structure rules (the S5-01 stance): one <section aria-labelledby> per
// course with a DETERMINISTIC id from the course id; the table carries an
// sr-only caption; the date column and (below 640) the whole head row are
// hidden VISUALLY only — screen readers keep every column (decision 5).

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { BadgeStatus } from "@/components/ui/badge-status";
import { buttonVariants } from "@/components/ui/button-variants";
import { formatWibDate } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { reviewReveals } from "@/components/learn/quiz/quiz-result";
import type {
  GradeCourseDTO,
  GradeResultDTO,
  GradesPageDTO,
} from "@/modules/attempt/service";

export type MyGradesProps = {
  data: GradesPageDTO;
};

const EYEBROW_CLASS =
  "font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-subtle";

/** The review link of one graded row (decision 6): the SAME quiz page that
 *  shows the result — "Lihat" at ≥ 1024, the ↗ icon below (8b/8t/8e), and
 *  the accessible name follows reviewAccess so a hidden policy never
 *  promises a "pembahasan". Touch target ≥ 44 × 44 below 1024. */
function ReviewLink({
  href,
  ariaLabel,
}: {
  href: string;
  ariaLabel: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="inline-flex size-11 items-center justify-center text-primary-deep lg:size-auto lg:min-h-11 lg:items-center"
    >
      <span className="hidden text-[13px] font-bold lg:inline">Lihat</span>
      <ArrowUpRight aria-hidden="true" className="size-5 shrink-0 lg:hidden" />
    </Link>
  );
}

/** One graded cell: the number plus an sr-only verdict, so the status is
 *  never carried by color alone (decision 12). */
function ScoreCell({ result }: { result: GradeResultDTO }) {
  return (
    <span className="font-mono">
      <span
        className={cn(
          "font-bold",
          result.isPassed ? "text-success" : "text-danger",
        )}
      >
        {result.scorePercent}
      </span>
      <span className="sr-only">
        {" "}
        {result.isPassed ? "lulus" : "belum lulus"}
      </span>
    </span>
  );
}

/** "—" for a column a "belum" row has nothing to show in. */
function DashCell() {
  return <span aria-hidden="true">—</span>;
}

function lessonReviewLabel(
  position: number,
  title: string,
  result: GradeResultDTO,
): string {
  return reviewReveals(result.reviewAccess)
    ? `Lihat pembahasan Quiz Materi ${position} · ${title}`
    : `Lihat jawaban Anda, Quiz Materi ${position} · ${title}`;
}

/** One course card: head (title + meta + badge + Nilai Akhir), the grades
 *  table, and the formula row. Weights are the page-level LIVE ones
 *  (decision 7) — passed down, never hardcoded here. */
function CourseCard({
  course,
  weights,
}: {
  course: GradeCourseDTO;
  weights: GradesPageDTO["weights"];
}) {
  const headingId = `nilai-${course.id}-heading`;
  const formulaText =
    course.nextStep === null
      ? `Rata-rata quiz materi ${course.lessonAveragePercent ?? "—"} × ${
          weights.lessonPercent
        }% + Final Quiz ${course.final?.result?.scorePercent ?? "—"} × ${
          weights.finalPercent
        }% = ${course.finalScorePercent ?? "—"}`
      : null;
  return (
    <section aria-labelledby={headingId} className="mt-10 first:mt-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2
            id={headingId}
            className="text-lg font-black tracking-tight text-text wrap-anywhere sm:text-xl"
          >
            {course.title}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {course.lessonCount} materi ·{" "}
            {course.meta.kind === "selesai" ? "selesai" : "terakhir diakses"}{" "}
            {formatWibDate(new Date(course.meta.at))}
          </p>
        </div>
        <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-start sm:gap-2">
          <BadgeStatus status={course.badge} />
          {/* DOM: label BEFORE the number (flex-col-reverse), so it reads
              "Nilai Akhir 68" (card §4). */}
          <div className="flex flex-col-reverse items-start sm:items-end">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-subtle">
              Nilai Akhir
            </p>
            <p
              className={cn(
                "font-mono text-3xl leading-none font-medium",
                course.badge === "lulus" ? "text-success" : "text-text",
              )}
            >
              {course.finalScorePercent ?? "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="relative mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Nilai quiz {course.title}</caption>
          <thead className="sr-only sm:not-sr-only">
            <tr>
              <th
                scope="col"
                className={cn(
                  EYEBROW_CLASS,
                  "border-b border-border px-0 py-2 pr-4 font-medium",
                )}
              >
                Materi / Quiz
              </th>
              <th
                scope="col"
                className={cn(
                  EYEBROW_CLASS,
                  "border-b border-border px-0 py-2 pr-4 font-medium",
                )}
              >
                Nilai
              </th>
              <th
                scope="col"
                className={cn(
                  EYEBROW_CLASS,
                  "hidden border-b border-border px-0 py-2 pr-4 font-medium sm:table-cell",
                )}
              >
                Tanggal
              </th>
              <th
                scope="col"
                className={cn(
                  EYEBROW_CLASS,
                  "border-b border-border px-0 py-2 text-right font-medium",
                )}
              >
                Pembahasan
              </th>
            </tr>
          </thead>
          <tbody>
            {course.lessons.map((lesson) => (
              <tr key={lesson.position} className="border-b border-border">
                <th
                  scope="row"
                  className="py-3 pr-4 align-top font-normal text-text"
                >
                  {lesson.position} · {lesson.title}
                </th>
                <td className="py-3 pr-4 align-top">
                  {lesson.result ? (
                    <ScoreCell result={lesson.result} />
                  ) : (
                    <span className="font-bold text-text-muted">belum</span>
                  )}
                </td>
                <td className="hidden py-3 pr-4 align-top text-text-muted sm:table-cell">
                  {lesson.result?.submittedAt ? (
                    formatWibDate(new Date(lesson.result.submittedAt))
                  ) : (
                    <DashCell />
                  )}
                </td>
                <td className="py-3 text-right align-top">
                  {lesson.result ? (
                    <ReviewLink
                      href={lesson.result.reviewHref}
                      ariaLabel={lessonReviewLabel(
                        lesson.position,
                        lesson.title,
                        lesson.result,
                      )}
                    />
                  ) : (
                    <DashCell />
                  )}
                </td>
              </tr>
            ))}
            {course.lockedCount > 0 && (
              <tr className="border-b border-border">
                <td
                  colSpan={4}
                  className="py-3 text-sm text-text-muted"
                >
                  + {course.lockedCount} materi terkunci
                </td>
              </tr>
            )}
            {course.final && (
              <tr className="bg-fill-soft font-bold">
                <th
                  scope="row"
                  className="py-3 pr-4 align-top text-text"
                >
                  Final Quiz · {course.final.questionCount} soal
                </th>
                <td className="py-3 pr-4 align-top">
                  {course.final.result ? (
                    <ScoreCell result={course.final.result} />
                  ) : (
                    <span className="text-text-muted">belum</span>
                  )}
                </td>
                <td className="hidden py-3 pr-4 align-top text-text-muted sm:table-cell">
                  {course.final.result?.submittedAt ? (
                    formatWibDate(new Date(course.final.result.submittedAt))
                  ) : (
                    <DashCell />
                  )}
                </td>
                <td className="py-3 text-right align-top">
                  {course.final.result ? (
                    <ReviewLink
                      href={course.final.result.reviewHref}
                      ariaLabel={
                        reviewReveals(course.final.result.reviewAccess)
                          ? `Lihat pembahasan Final Quiz · ${course.title}`
                          : `Lihat jawaban Anda, Final Quiz · ${course.title}`
                      }
                    />
                  ) : (
                    <DashCell />
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 bg-fill-soft px-4 py-3 font-mono text-[12.5px] uppercase tracking-wide text-text-muted">
        {formulaText ??
          `Rata-rata quiz materi sementara ${
            course.lessonAveragePercent ?? "—"
          } · Nilai Akhir belum dihitung`}
      </p>
      {course.nextStep !== null && (
        <p className="mt-2 text-sm text-text">
          {course.nextStep === "materi"
            ? "Selesaikan semua materi lalu kerjakan Final Quiz."
            : "Semua materi selesai."}
          {course.nextStep === "final" && course.final && (
            <>
              {" "}
              <Link
                href={course.final.reviewHref}
                className="font-bold text-primary-deep underline"
              >
                Kerjakan Final Quiz
              </Link>
            </>
          )}
        </p>
      )}
    </section>
  );
}

export function MyGrades({ data }: MyGradesProps) {
  const { weights, courses } = data;
  return (
    <div>
      <p className={EYEBROW_CLASS}>Belajar / Nilai Saya</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-text sm:text-3xl">
        Nilai Saya
      </h1>
      {courses.length === 0 ? (
        // 8f: built inline (decision 10) — EmptyState is "use client",
        // two-action, h3-headed; this state needs none of that.
        <div className="mt-8 rounded-card border border-dashed border-border-dashed bg-surface-2 p-6 sm:p-8">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-meta">
            Belum ada nilai
          </p>
          <h2 className="mt-2 text-xl font-black tracking-tight text-text">
            Belum ada quiz yang dikerjakan
          </h2>
          <p className="mt-2 max-w-prose text-sm text-text-muted">
            Nilai muncul di sini setiap kali Anda menyelesaikan satu quiz
            materi. Nilai Akhir kursus baru dihitung setelah Final Quiz.
          </p>
          <p className="mt-4 rounded-card border border-border bg-surface px-4 py-3 text-sm text-text">
            Rumusnya:{" "}
            <strong className="font-bold">
              rata-rata quiz materi × {weights.lessonPercent}% + Final Quiz ×{" "}
              {weights.finalPercent}%
            </strong>
            .
          </p>
          <Link
            href="/belajar"
            className={cn(
              buttonVariants({ variant: "dark", size: "lg" }),
              "mt-6 w-full sm:w-auto",
            )}
          >
            Lanjutkan kursus saya
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-3 max-w-prose text-sm text-text-muted">
            Setiap quiz dikerjakan satu kali, jadi nilai di bawah bersifat
            final.{" "}
            <strong className="font-bold text-text">
              Nilai Akhir Kursus = rata-rata quiz materi ×{" "}
              {weights.lessonPercent}% + Final Quiz × {weights.finalPercent}%.
            </strong>{" "}
            Ini transkrip nilai, bukan sertifikat.
          </p>
          <div className="mt-2">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} weights={weights} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
