// CourseProgress (card S5-04 §4) — the /belajar/{kursus} page body (8c).
// Pure render over the progres DTO + the score weights (server component;
// the weights arrive as PROPS from the page — this module never imports
// the quiz module, src/modules/README.md).
//
// The per-lesson status was decided in the serializer (courseLessonStatus,
// decision 3) — this file only maps a status to its 8c presentation:
// icon, status line, row background, and action. Status text is real DOM
// text (never color/icon only); the mono ALL-CAPS look is CSS `uppercase`.
// Text never uses `primary`; `success`/`danger` only on surface-family
// backgrounds (the contrast table in the card's Catatan tinjauan).

import Link from "next/link";
import { Check, Lock } from "lucide-react";

import { ProgressBar } from "@/components/ui/progress-bar";
import { buttonVariants } from "@/components/ui/button-variants";
import { formatWibDate } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type {
  CourseProgressLessonDTO,
  CourseProgressPageDTO,
} from "@/modules/progress/service";
import type { ScoreWeights } from "@/modules/quiz/service";

import { formatPlaybackClock } from "./playback-clock";

export type CourseProgressProps = {
  progres: Extract<CourseProgressPageDTO, { state: "progres" }>;
  weights: ScoreWeights;
};

/** The mono eyebrow — the SAME class Nilai Saya uses (PR 150 review item 8),
 *  kept local so my-grades.tsx stays untouched. */
const EYEBROW_CLASS =
  "font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-subtle";

/** The 8c status cell: icon (decorative) + the status line as real text. */
function LessonStatus({
  lesson,
}: {
  lesson: CourseProgressLessonDTO;
}) {
  if (lesson.status === "selesai") {
    return (
      <p
        className={cn(
          "font-mono text-xs font-medium uppercase tracking-wide",
          lesson.isPassed === false ? "text-danger" : "text-success",
        )}
      >
        Selesai · Nilai {lesson.scorePercent}
        {lesson.isPassed === false ? " · Belum lulus" : ""}
      </p>
    );
  }
  if (lesson.status === "quiz-belum") {
    return (
      <p className="font-mono text-xs font-medium uppercase tracking-wide text-warning-tint-text">
        {lesson.hasVideo ? "Video selesai · " : ""}Quiz belum dikerjakan
      </p>
    );
  }
  if (lesson.status === "sedang-dipelajari") {
    return (
      <p className="font-mono text-xs font-medium uppercase tracking-wide text-primary-deep">
        Sedang dipelajari
        {lesson.video === null
          ? ""
          : ` · ${formatPlaybackClock(lesson.video.positionSeconds)} / ${formatPlaybackClock(lesson.video.durationSeconds)}`}
      </p>
    );
  }
  if (lesson.status === "terkunci") {
    return (
      <p className="font-mono text-xs font-medium uppercase tracking-wide text-text-subtle">
        Terkunci
      </p>
    );
  }
  // belum-mulai: 8c puts the mono label at the RIGHT end, no status line.
  return null;
}

/** The 8c leading icon per status — a 28px FILLED shape (review item 7),
 *  decorative, aria-hidden. `primary` on the ring and `success`/`warning`
 *  fills are non-text elements — exactly what those tokens are for. */
function LessonIcon({ lesson }: { lesson: CourseProgressLessonDTO }) {
  if (lesson.status === "selesai") {
    return (
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-success">
        <Check aria-hidden="true" className="size-3.5 text-surface" />
      </span>
    );
  }
  if (lesson.status === "quiz-belum") {
    return (
      <span
        aria-hidden="true"
        className="grid size-7 shrink-0 place-items-center rounded-full bg-warning text-[14px] font-bold leading-none text-text"
      >
        !
      </span>
    );
  }
  if (lesson.status === "sedang-dipelajari") {
    return (
      <span
        aria-hidden="true"
        className="size-7 shrink-0 rounded-full border-[2.5px] border-primary"
      />
    );
  }
  if (lesson.status === "terkunci") {
    return <LockedCircle />;
  }
  return (
    <span aria-hidden="true" className="size-7 shrink-0 rounded-full bg-fill" />
  );
}

/** Terkunci (lesson AND Final): a small lock in a fill-soft circle. */
function LockedCircle() {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-fill-soft">
      <Lock aria-hidden="true" className="size-3.5 text-text-subtle" />
    </span>
  );
}

const rowTone = (lesson: CourseProgressLessonDTO) =>
  lesson.status === "quiz-belum"
    ? "border-warning-tint-line bg-warning-tint"
    : lesson.status === "sedang-dipelajari"
      ? "border-border bg-primary-tint"
      : lesson.status === "selesai"
        ? "border-border bg-surface"
        : "border-border bg-surface-2";

/** One lesson row (8c): "{posisi} · {judul}" links to the lesson page
 *  unless terkunci; the action row also names its lesson (user addition
 *  11b: aria-describedby → the row's own title). */
function LessonRow({
  lesson,
  titleId,
}: {
  lesson: CourseProgressLessonDTO;
  titleId: string;
}) {
  const isLocked = lesson.status === "terkunci";
  const titleText = `${lesson.position} · ${lesson.title}`;

  return (
    <li
      className={cn(
        "flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 rounded-card border px-4 py-3",
        rowTone(lesson),
      )}
    >
      <LessonIcon lesson={lesson} />
      <div className="min-w-0 flex-1">
        {isLocked ? (
          <p
            id={titleId}
            className="wrap-anywhere text-[15px] font-bold text-text-muted"
          >
            {titleText}
          </p>
        ) : (
          <Link
            id={titleId}
            href={lesson.href!}
            className="wrap-anywhere text-[15px] font-bold text-text underline-offset-4 hover:underline"
          >
            {titleText}
          </Link>
        )}
        <LessonStatus lesson={lesson} />
      </div>
      {/* Actions: basis-full below 640 so they drop UNDER the text (review
          item 5) instead of squeezing the title into ±130 px; the CTA
          buttons go w-full there (sm:w-auto). Text links get a ≥ 44 px
          inline-flex band (item 6) without changing how they look. */}
      <div className="flex basis-full flex-wrap items-center gap-3 sm:basis-auto">
        {lesson.status === "belum-mulai" ? (
          <span className="font-mono text-xs font-medium uppercase tracking-wide text-text-meta">
            Belum mulai
          </span>
        ) : null}
        {lesson.status === "selesai" ? (
          <Link
            href={lesson.href!}
            aria-describedby={titleId}
            className="inline-flex min-h-11 items-center text-sm font-bold text-primary-deep underline-offset-4 hover:underline"
          >
            {lesson.hasVideo ? "Tonton ulang" : "Buka materi"}
          </Link>
        ) : null}
        {lesson.status === "quiz-belum" ? (
          // Decision 5: to the LESSON page, so the S3-01 confirm dialog
          // (QZ-18 step one) is always passed through.
          <Link
            href={lesson.href!}
            aria-describedby={titleId}
            className={cn(
              buttonVariants({ variant: "dark" }),
              "w-full text-sm sm:w-auto",
            )}
          >
            Kerjakan quiz
          </Link>
        ) : null}
        {lesson.status === "sedang-dipelajari" ? (
          <Link
            href={lesson.href!}
            aria-describedby={titleId}
            className={cn(
              buttonVariants({ variant: "primary" }),
              "w-full text-sm sm:w-auto",
            )}
          >
            Lanjutkan
          </Link>
        ) : null}
      </div>
    </li>
  );
}

/** The Final Quiz row under the list (8c bottom). */
function FinalRow({
  final,
  lessonCount,
  weights,
}: {
  final: NonNullable<
    CourseProgressProps["progres"]["final"]
  >;
  lessonCount: number;
  weights: ScoreWeights;
}) {
  return (
    <div
      className={cn(
        "flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 rounded-card border px-4 py-3",
        final.status === "terbuka"
          ? "border-border bg-surface"
          : "border-border bg-surface-2",
      )}
    >
      {/* Item 7: the check is DONE-only — terbuka gets the neutral fill
          circle, never a check. */}
      {final.status === "terkunci" ? (
        <LockedCircle />
      ) : final.status === "selesai" ? (
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-success">
          <Check aria-hidden="true" className="size-3.5 text-surface" />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="size-7 shrink-0 rounded-full bg-fill"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold text-text">
          Final Quiz · {final.questionCount} soal
        </p>
        <p className="font-mono text-xs font-medium uppercase tracking-wide text-text-muted">
          {final.status === "terkunci"
            ? `Terbuka setelah ${lessonCount} materi selesai · ${final.durationMinutes} menit · bobot ${weights.finalPercent}%`
            : final.status === "terbuka"
              ? `Terbuka · ${final.durationMinutes} menit · bobot ${weights.finalPercent}%`
              : "Sudah dikerjakan"}
        </p>
      </div>
      {final.status === "terbuka" ? (
        <Link
          href={final.href}
          className={cn(buttonVariants({ variant: "dark" }), "text-sm")}
        >
          Kerjakan Final Quiz
        </Link>
      ) : null}
      {final.status === "selesai" ? (
        <Link
          href={final.href}
          className="inline-flex min-h-11 items-center text-sm font-bold text-primary-deep underline-offset-4 hover:underline"
        >
          Lihat hasil
        </Link>
      ) : null}
    </div>
  );
}

/** The 8c right-column summary box. */
function Ringkasan({
  progres,
  weights,
}: {
  progres: CourseProgressProps["progres"];
  weights: ScoreWeights;
}) {
  const isDone =
    progres.badge === "selesai" || progres.badge === "lulus";
  const average =
    progres.lessonAveragePercent === null
      ? "—"
      : String(progres.lessonAveragePercent);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card border border-border bg-surface-2 p-5">
        <h2 className="text-sm font-bold text-text">Ringkasan nilai</h2>
        <p className="mt-3 font-mono text-[38px] font-medium leading-none text-text">
          {average}
        </p>
        <p className="mt-1 font-mono text-xs font-medium uppercase tracking-wide text-text-muted">
          rata-rata {progres.gradedLessonCount} quiz materi
        </p>
        {isDone ? (
          <p className="mt-4 text-sm font-bold text-text">
            Nilai Akhir {progres.finalScorePercent} ·{" "}
            {progres.badge === "lulus" ? "Lulus" : "Selesai"}
          </p>
        ) : (
          <p className="mt-4 text-sm text-text-muted">
            Nilai Akhir = {average} × {weights.lessonPercent}% + Final Quiz ×{" "}
            {weights.finalPercent}%.
          </p>
        )}
        <Link
          href="/belajar/nilai"
          className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-primary-deep underline-offset-4 hover:underline"
        >
          Lihat di Nilai Saya
        </Link>
      </div>

      {progres.hasFailedLesson ? (
        <div className="rounded-card border border-border bg-surface-2 p-5">
          <p className="text-sm text-text-muted">
            Nilai di bawah batas lulus tidak mengunci apa pun — materi tetap
            tercatat selesai dan Anda boleh lanjut. Nilai itu permanen
            karena quiz hanya sekali.
          </p>
        </div>
      ) : null}

      <p className="font-mono text-xs font-medium uppercase tracking-wide text-text-meta">
        Terakhir diakses {formatWibDate(new Date(progres.lastActivityAt))}
      </p>
    </div>
  );
}

export function CourseProgress({ progres, weights }: CourseProgressProps) {
  const isDone = progres.badge === "selesai" || progres.badge === "lulus";
  const pct = Math.round(
    (progres.completedLessonCount / progres.lessonCount) * 100,
  );

  return (
    <>
      <header>
        <p className={EYEBROW_CLASS}>Belajar / Kursus Saya</p>
        <h1 className="mt-2 wrap-anywhere text-[25px] font-black leading-[1.14] tracking-[-0.022em] text-text sm:text-[32px] sm:leading-[1.16] sm:tracking-[-0.024em]">
          {progres.course.title}
        </h1>
        <div className="mt-4 max-w-(--width-measure)">
          <ProgressBar
            value={progres.completedLessonCount}
            max={progres.lessonCount}
            tone={isDone ? "success" : "primary"}
            label={`Progress ${progres.course.title}`}
          />
          <p className="mt-2 font-mono text-xs font-medium uppercase tracking-wide text-text-muted">
            {pct}% · {progres.completedLessonCount}/{progres.lessonCount}{" "}
            materi
          </p>
        </div>
      </header>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <ul className="flex flex-col gap-3">
            {progres.lessons.map((lesson) => (
              <LessonRow
                key={lesson.href ?? lesson.position}
                lesson={lesson}
                titleId={`progres-materi-${lesson.position}`}
              />
            ))}
          </ul>
          {progres.final !== null ? (
            <div className="mt-3">
              <FinalRow
                final={progres.final}
                lessonCount={progres.lessonCount}
                weights={weights}
              />
            </div>
          ) : null}
        </div>
        <aside className="w-full lg:w-80 lg:shrink-0">
          <Ringkasan progres={progres} weights={weights} />
        </aside>
      </div>
    </>
  );
}
