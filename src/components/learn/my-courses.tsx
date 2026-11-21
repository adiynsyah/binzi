// MyCourses (card S5-04 §3) — the /belajar/kursus-saya page body: 13b/13t/13d
// filled, 13c empty. Pure render over the MyCoursesPageDTO (server
// component, no "use client") — the only client piece is StartCourseButton
// in the empty state's available list.
//
// Structure rules follow the dashboard (learn-dashboard.tsx): every course
// card is an <article aria-labelledby> with a DETERMINISTIC id built from
// the course id, and each action's aria-describedby points at that title
// (WCAG 2.5.3 — the button labels repeat on every card).
//
// Layout: cover ≥ 640 as a 96px box left of the content, < 640 above the
// card (13d); actions ≥ 1024 a stacked right column, 640–1023 below the
// card as half-width buttons (13t), < 640 full width — all ≥ 44px via the
// button size band.

import Link from "next/link";

import { BadgeStatus } from "@/components/ui/badge-status";
import { ProgressBar } from "@/components/ui/progress-bar";
import { buttonVariants } from "@/components/ui/button-variants";
import { formatWibDate } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type {
  LearnerCourseDTO,
  MyCourseDTO,
  MyCoursesPageDTO,
} from "@/modules/progress/service";

import { CoverBlock } from "./learn-dashboard";
import { StartCourseButton } from "./start-course-button";

export type MyCoursesProps = {
  data: MyCoursesPageDTO;
};

/** The meta mono line under the badge — DOM text lowercase, uppercased by
 *  CSS like every mono meta in the learn area (13b: "4/8 MATERI ·
 *  TERAKHIR DIBUKA …"). */
function metaLine(course: MyCourseDTO): string {
  const counts = `${course.completedLessonCount}/${course.lessonCount} materi`;
  const at = formatWibDate(new Date(course.meta.at));
  if (course.meta.kind === "selesai") {
    return `${counts} · selesai ${at} · Nilai Akhir ${course.finalScorePercent}`;
  }
  if (course.meta.kind === "diikuti") {
    return `${counts} · diikuti ${at}`;
  }
  return `${counts} · terakhir dibuka ${at}`;
}

/** The row under the title — only the two running states have one
 *  (card §3: selesai/lulus has none; the fields are null in the DTO). */
function subLine(course: MyCourseDTO): string | null {
  if (course.badge === "sedang-berjalan" && course.lastLessonTitle !== null) {
    return `Terakhir dibuka: ${course.lastLessonTitle}`;
  }
  if (course.badge === "belum-dimulai") {
    return course.estimatedMinutes === null
      ? "Belum ada materi yang dibuka"
      : `Belum ada materi yang dibuka · ${course.estimatedMinutes} menit total`;
  }
  return null;
}

/** One enrolled course card (13b). The action set follows the badge —
 *  three different calls to action for the three moments of a course
 *  (design t13 decision). */
function CourseCard({ course }: { course: MyCourseDTO }) {
  const titleId = `kursus-saya-${course.id}`;
  const isDone = course.badge === "selesai" || course.badge === "lulus";
  const sub = subLine(course);

  return (
    <article
      aria-labelledby={titleId}
      className="rounded-card border border-border bg-surface p-4 sm:grid sm:grid-cols-[96px_minmax(0,1fr)] sm:items-center sm:gap-4 lg:grid-cols-[96px_minmax(0,1fr)_210px]"
    >
      <CoverBlock className="h-[110px] w-full rounded-control sm:row-start-1 sm:h-24 sm:w-24" />
      <div className="mt-3 grid min-w-0 gap-2 sm:mt-0 sm:row-start-1 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-3">
        <BadgeStatus
          status={course.badge}
          className="justify-self-start sm:col-start-1 sm:row-start-1"
        />
        <p className="font-mono text-xs font-medium uppercase tracking-wide text-text-muted sm:col-start-2 sm:row-start-1 sm:self-center sm:justify-self-end sm:text-right">
          {metaLine(course)}
        </p>
        <h2
          id={titleId}
          className="wrap-anywhere text-base font-bold text-text sm:col-span-2 sm:row-start-2"
        >
          {course.title}
        </h2>
        {sub !== null ? (
          <p className="text-[13.5px] text-text-muted sm:col-span-2 sm:row-start-3">
            {sub}
          </p>
        ) : null}
        <div className="mt-1 sm:col-span-2 sm:row-start-4 sm:mt-0">
          <ProgressBar
            value={course.completedLessonCount}
            max={course.lessonCount}
            tone={isDone ? "success" : "primary"}
            label={`Progress ${course.title}`}
          />
        </div>
      </div>
      {/* Actions: < 640 stacked full width; 640–1023 below the card as
          half-width buttons (13t); ≥ 1024 the stacked right column (13b).
          Every control names its course via aria-describedby → h2. */}
      <div className="mt-3 flex flex-col gap-3 sm:col-span-2 sm:row-start-2 sm:mt-4 sm:grid sm:grid-cols-2 lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:mt-0 lg:flex">
        {isDone ? (
          <>
            <Link
              href="/belajar/nilai"
              aria-describedby={titleId}
              className={cn(buttonVariants({ variant: "secondary" }), "w-full")}
            >
              Lihat nilai
            </Link>
            <Link
              href={course.progressHref}
              aria-describedby={titleId}
              className={cn(buttonVariants({ variant: "secondary" }), "w-full")}
            >
              Lihat progress
            </Link>
          </>
        ) : course.badge === "belum-dimulai" ? (
          <Link
            href={course.continueHref}
            aria-describedby={titleId}
            className={cn(buttonVariants({ variant: "dark" }), "w-full")}
          >
            Mulai materi 1
          </Link>
        ) : (
          <>
            <Link
              href={course.continueHref}
              aria-describedby={titleId}
              className={cn(buttonVariants({ variant: "primary" }), "w-full")}
            >
              Lanjutkan
            </Link>
            <Link
              href={course.progressHref}
              aria-describedby={titleId}
              className={cn(buttonVariants({ variant: "secondary" }), "w-full")}
            >
              Lihat progress
            </Link>
          </>
        )}
      </div>
    </article>
  );
}

/** 13c — the empty state with the available list. The intro sentence and
 *  the row shape are the card's (decision 10: rows carry a real
 *  StartCourseButton, not the design's "Lihat →" — nothing is enrolled
 *  yet, so starting is exactly what the moment asks for). */
function EmptyCourses({ available }: { available: LearnerCourseDTO[] }) {
  return (
    <div className="rounded-card border border-dashed border-border-dashed bg-surface-2 p-5 sm:p-6">
      <p className="font-mono text-xs font-bold uppercase tracking-wide text-primary-deep">
        Belum ada kursus
      </p>
      <h2 className="mt-2 text-xl font-black tracking-tight text-text">
        Anda belum mengikuti kursus apa pun
      </h2>
      <p className="mt-2 max-w-(--width-measure) text-sm text-text-muted">
        {available.length > 0
          ? `${available.length} kursus tersedia dan semuanya gratis.`
          : "Belum ada kursus yang bisa diikuti saat ini."}
      </p>
      {available.length > 0 ? (
        <ul className="mt-6 flex flex-col gap-5">
          {available.map((course) => {
            const titleId = `kursus-tersedia-${course.id}`;
            return (
              <li
                key={course.id}
                className="grid grid-cols-[56px_minmax(0,1fr)] gap-3"
              >
                <CoverBlock className="h-[42px] w-14 shrink-0 rounded-sm" />
                <div className="min-w-0">
                  <h3
                    id={titleId}
                    className="wrap-anywhere text-[14.5px] font-bold text-text"
                  >
                    {course.title}
                  </h3>
                  <p className="mt-1 font-mono text-xs font-medium uppercase tracking-wide text-text-meta">
                    {course.lessonCount} materi
                    {course.estimatedMinutes === null
                      ? ""
                      : ` · ${course.estimatedMinutes} menit`}
                  </p>
                  <StartCourseButton
                    courseId={course.id}
                    variant="secondary"
                    className="mt-3 w-full"
                    aria-describedby={titleId}
                  >
                    Mulai materi 1
                  </StartCourseButton>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      <Link
        href="/kursus"
        className={cn(
          buttonVariants({ variant: "primary" }),
          "mt-6 w-full sm:w-auto",
        )}
      >
        Jelajahi semua kursus
      </Link>
    </div>
  );
}

export function MyCourses({ data }: MyCoursesProps) {
  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-wide text-primary-deep">
            Belajar / Kursus Saya
          </p>
          <h1 className="mt-2 text-[25px] font-black leading-[1.14] tracking-[-0.022em] text-text sm:text-[32px] sm:leading-[1.16] sm:tracking-[-0.024em]">
            Kursus Saya
          </h1>
          {data.courses.length > 0 ? (
            <p className="mt-3 max-w-(--width-measure) text-text-muted">
              {data.courses.length} kursus yang Anda ikuti. Progress
              tersimpan otomatis — boleh dilanjut kapan saja.
            </p>
          ) : null}
        </div>
        {data.courses.length > 0 ? (
          <Link
            href="/kursus"
            className={cn(
              buttonVariants({ variant: "secondary" }),
              "w-full sm:w-auto lg:w-auto",
            )}
          >
            Jelajahi kursus lain
          </Link>
        ) : null}
      </div>

      {data.courses.length > 0 ? (
        <div className="mt-8 flex flex-col gap-4">
          {data.courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyCourses available={data.available} />
        </div>
      )}
    </>
  );
}
