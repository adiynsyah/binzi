// CourseDetail (card S6-02 §4) — the /kursus/{slug} body over the public
// detail DTO: breadcrumb, header (7b/7m), the enroll CTA, the FULL lesson
// outline, and the description. Server component, pure render.
//
// Layout (7b/7t/keputusan 9): ≥ 1024 two columns — the header AND content
// share the left column while the CTA card spans both rows on the right
// (± 380 px, not sticky, top-aligned with the h1); below that one column
// with the CTA DIRECTLY after the header. DOM order — header, CTA,
// content — is the reading order at every width.
//
// The outline is deliberately NOT links and carries no "Preview"/"Terkunci"
// labels (keputusan 5): every row is visible plain text, positions come
// from the DTO (1-based), and the mono metas are DOM-lowercase uppercased
// by CSS (my-courses pattern).

import Link from "next/link";

import { formatPlaybackClock } from "@/components/learn/playback-clock";
import { RichContent } from "@/components/shared/rich-content";
import { cn } from "@/lib/utils";
import type { PublicCourseDetailDTO } from "@/modules/course/service";

import { CourseEnrollCta } from "./course-enroll-cta";

export type CourseDetailProps = {
  course: PublicCourseDetailDTO;
};

/** The mono eyebrow — same class as the catalog, kept local per card §3. */
const EYEBROW_CLASS =
  "font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-subtle";

/** The h1 the CTA's aria-describedby names (WCAG 2.5.3). */
const TITLE_ID = "kursus-detail-judul";

function metaLine(course: PublicCourseDetailDTO): string {
  const minutes =
    course.estimatedMinutes === null ? "" : ` · ${course.estimatedMinutes} menit`;
  return `${course.levelLabel} · ${course.lessonCount} materi${minutes} · Quiz per materi`;
}

/** One outline row: decorative number circle + "{pos} · {title}" and the
 *  mono video/text meta. ≥ 56 px tall, never a link. */
function LessonRow({
  lesson,
}: {
  lesson: PublicCourseDetailDTO["lessons"][number];
}) {
  return (
    <li className="flex min-h-14 items-center gap-3.5 rounded-card border border-border bg-surface-2 px-4 py-3">
      <span
        aria-hidden="true"
        className="grid size-7 shrink-0 place-items-center rounded-full bg-fill font-mono text-xs font-bold text-text"
      >
        {lesson.position}
      </span>
      <div className="min-w-0">
        <h3 className="wrap-anywhere text-[15px] font-bold text-text">
          {lesson.position} · {lesson.title}
        </h3>
        <p className="mt-0.5 font-mono text-xs font-medium uppercase tracking-wide text-text-meta">
          {lesson.durationSeconds === null
            ? "materi teks"
            : `${formatPlaybackClock(lesson.durationSeconds)} · video`}
        </p>
      </div>
    </li>
  );
}

export function CourseDetail({ course }: CourseDetailProps) {
  return (
    <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[auto_1fr]">
      {/* The header is the grid's FIRST element: ≥ 1024 it fills the left
          column so the CTA card aligns with the h1 (7b, PR 153 review
          item 4); below that the plain stack keeps keputusan 9 — header,
          then CTA, then content. */}
      <header className="lg:col-start-1 lg:row-start-1">
        <nav aria-label="Breadcrumb">
          <Link
            href="/kursus"
            className={cn(EYEBROW_CLASS, "inline-flex min-h-11 min-w-11 items-center")}
          >
            Kursus
          </Link>
        </nav>

        <h1
          id={TITLE_ID}
          className="mt-2 wrap-anywhere text-[25px] font-black leading-[1.14] tracking-[-0.022em] text-text sm:text-[32px] sm:leading-[1.16] sm:tracking-[-0.024em]"
        >
          {course.title}
        </h1>
        <p className="mt-3 text-[13px] font-bold text-text-muted">
          {metaLine(course)}
        </p>
        {course.summary !== null ? (
          <p className="mt-3 max-w-(--width-measure) text-text-muted">
            {course.summary}
          </p>
        ) : null}
        {/* 7t "DITINJAU AHLI GIZI" as a chip (keputusan 7): no reviewer box,
            no name — the review is a fact about every published course. */}
        <p className="mt-4 inline-flex rounded-full border border-border px-3 py-[5px] font-mono text-xs font-medium uppercase tracking-wide text-text-muted">
          Ditinjau ahli gizi
        </p>
      </header>

      {/* Second in the DOM so < 1024 keeps the CTA right after the header
          (keputusan 9); ≥ 1024 it spans both rows on the right, top-aligned
          with the h1. */}
      <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-start">
        <CourseEnrollCta
          courseId={course.id}
          slug={course.slug}
          titleId={TITLE_ID}
        />
      </div>

      <div className="lg:col-start-1 lg:row-start-2">
          <section aria-labelledby="isi-kursus-heading">
            <h2
              id="isi-kursus-heading"
              className="text-xl font-black tracking-tight text-text sm:text-2xl"
            >
              Isi kursus
            </h2>
            <p className="mt-2 max-w-(--width-measure) text-text-muted">
              Seluruh materi terlihat supaya Anda tahu apa yang dipelajari.
            </p>
            <ol className="mt-4 flex flex-col gap-2.5">
              {course.lessons.map((lesson) => (
                <LessonRow key={lesson.position} lesson={lesson} />
              ))}
            </ol>
            <p className="mt-4 rounded-card border border-dashed border-border-dashed bg-surface-2 p-4 text-sm text-text-muted">
              {course.hasFinalQuiz
                ? "Quiz di setiap materi · Final Quiz di akhir"
                : "Quiz di setiap materi"}
            </p>
          </section>

          <section aria-labelledby="tentang-kursus-heading" className="mt-10">
            <h2
              id="tentang-kursus-heading"
              className="text-xl font-black tracking-tight text-text sm:text-2xl"
            >
              Tentang kursus ini
            </h2>
            {/* RichContent re-validates (§12.3) and renders nothing for a
                null doc — a published course always carries one. */}
            <div className="mt-4">
              <RichContent doc={course.description} />
            </div>
          </section>
      </div>
    </div>
  );
}
