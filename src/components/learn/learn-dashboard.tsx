// LearnDashboard (card S5-01 §3) — every state of /belajar in ONE server
// component (no "use client": it is pure render over the dashboard DTO).
//
// States: A new participant (28a/28b) · B returning participant ("Kursus
// saya", 8a) · C nothing published yet (EmptyState). "Kursus lainnya"
// rides along in A and B whenever there is more to offer (card §3.E).
//
// Structure rules (card §3 + owner review 11 Nov no. 7): every course card
// or row is an <article aria-labelledby> with a DETERMINISTIC id built from
// the course id, so e2e tests can address rows by their tokened title and
// the aria-describedby of each action points at that title (WCAG 2.5.3).
// Sections use <section aria-labelledby>; no <aside> in this dashboard.

import Link from "next/link";
import type { ComponentProps } from "react";

import { BadgeStatus } from "@/components/ui/badge-status";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import type {
  EnrolledCourseDTO,
  LearnerCourseDTO,
  LearnerDashboardDTO,
} from "@/modules/progress/service";

import { StartCourseButton } from "./start-course-button";

export type LearnDashboardProps = {
  /** Empty string drops the name part of the greeting (A-14b rule). */
  firstName: string;
  dashboard: LearnerDashboardDTO;
};

/** The cover placeholder every course block shares until S1-07 art exists.
 *  aria-hidden as a whole — decorative gradient (children included). */
function CoverBlock({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("bg-primary-tint", className)}
      style={{ backgroundImage: "var(--video-bg)" }}
      {...props}
    >
      {children}
    </div>
  );
}

/** "Cara belajar di BINZI" — copy verbatim from 28a (≥ 640 only; below
 *  that the 28b note carries the one rule that matters). */
const HOW_IT_WORKS_STEPS = [
  {
    number: "01",
    title: "Tonton & baca materi",
    body: "Video pendek plus teks; bisa berhenti dan lanjut kapan saja.",
  },
  {
    number: "02",
    title: "Quiz satu kesempatan",
    body: "Setiap quiz hanya sekali — baca materinya dulu sampai tuntas.",
  },
  {
    number: "03",
    title: "Pantau di Nilai Saya",
    body: "Nilai Akhir = quiz materi 60% + Final Quiz 40%.",
  },
] as const;

function HowItWorks() {
  return (
    <>
      <section
        aria-labelledby="cara-belajar-heading"
        className="mt-10 hidden sm:block"
      >
        <h2
          id="cara-belajar-heading"
          className="text-xl font-black tracking-tight text-text sm:text-2xl"
        >
          Cara belajar di BINZI
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map((step) => (
            <div
              key={step.number}
              className="rounded-card border border-border bg-surface-2 p-5"
            >
              <p className="font-mono text-[13px] font-bold text-primary-deep">
                {step.number}
              </p>
              <h3 className="mt-2 text-[15.5px] font-bold text-text">
                {step.title}
              </h3>
              <p className="mt-1 text-[13.5px] text-text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </section>
      {/* < 640 the three cards are too cramped at 360 — 28b keeps only the
          one rule a first-time participant can break by accident. */}
      <p className="mt-6 rounded-card border border-dashed border-border-dashed bg-surface-2 p-4 text-sm text-text-muted sm:hidden">
        <strong className="font-bold text-text">Quiz hanya sekali.</strong>{" "}
        Nilai muncul di Nilai Saya setelah quiz pertama selesai.
      </p>
    </>
  );
}

/** State A's featured card — available[0], the newest publication (28a).
 *  The "Paling banyak diikuti" pill and "Lihat semua kursus" button are
 *  owner-cut for the demo (ordering is by published_at, not popularity;
 *  /kursus is still "coming soon") — card §3.A. */
function FeaturedCard({ course }: { course: LearnerCourseDTO }) {
  const titleId = `belajar-unggulan-${course.id}`;
  const meta = `${course.lessonCount} MATERI${
    course.estimatedMinutes === null ? "" : ` · ${course.estimatedMinutes} MENIT`
  }`;
  return (
    <article
      aria-labelledby={titleId}
      className="mt-8 grid overflow-hidden rounded-card border-[1.5px] border-primary/30 bg-primary-tint sm:grid-cols-[236px_minmax(0,1fr)]"
    >
      <CoverBlock className="relative min-h-[120px] sm:min-h-[190px]">
        <p className="absolute bottom-3 left-3 font-mono text-xs font-medium uppercase tracking-wide text-surface">
          {meta}
        </p>
      </CoverBlock>
      <div className="p-4 sm:p-6">
        <p className="font-mono text-xs font-bold uppercase tracking-wide text-primary-deep">
          MULAI DARI SINI
        </p>
        <h2
          id={titleId}
          className="mt-2 wrap-anywhere text-xl font-black tracking-tight text-text sm:text-2xl"
        >
          {course.title}
        </h2>
        {/* Summary row is ≥ 640 only (28b has no room for it); no summary
            → the level alone. */}
        <p className="mt-2 hidden text-sm text-text-muted sm:block">
          {course.summary === null
            ? course.levelLabel
            : `${course.levelLabel} · ${course.summary}`}
        </p>
        <StartCourseButton
          courseId={course.id}
          variant="primary"
          className="mt-5 w-full sm:w-auto"
          aria-describedby={titleId}
        >
          Mulai materi 1
        </StartCourseButton>
      </div>
    </article>
  );
}

/** State B's list — "Kursus saya" rows from 8a: badge, meta, title,
 *  progress, and a plain LINK (not a POST — already enrolled). */
function KursusSaya({ courses }: { courses: EnrolledCourseDTO[] }) {
  return (
    <section aria-labelledby="kursus-saya-heading" className="mt-8">
      <h2
        id="kursus-saya-heading"
        className="text-xl font-black tracking-tight text-text sm:text-2xl"
      >
        Kursus saya
      </h2>
      <div className="mt-4 flex flex-col gap-4">
        {courses.map((course) => {
          const titleId = `kursus-saya-${course.id}`;
          return (
            <article
              key={course.id}
              aria-labelledby={titleId}
              className="rounded-card border border-border bg-surface p-4 sm:grid sm:grid-cols-[96px_minmax(0,1fr)_150px] sm:items-center sm:gap-4"
            >
              <CoverBlock className="h-[110px] w-full rounded-control sm:h-16 sm:w-24" />
              {/* DOM order = the 360 reading order of 13d (badge → title →
                  meta → progress); the sm grid placement re-flows it into
                  8a's badge-left/meta-right rows without reordering nodes. */}
              <div className="mt-3 grid min-w-0 gap-2 sm:mt-0 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-3">
                <BadgeStatus
                  status={course.badge}
                  className="justify-self-start sm:col-start-1 sm:row-start-1"
                />
                <h3
                  id={titleId}
                  className="wrap-anywhere text-base font-bold text-text sm:col-span-2 sm:row-start-2"
                >
                  {course.title}
                </h3>
                <p className="font-mono text-xs font-medium uppercase tracking-wide text-text-muted sm:col-start-2 sm:row-start-1 sm:self-center">
                  {course.completedLessonCount}/{course.lessonCount} MATERI
                </p>
                <div className="sm:col-span-2 sm:row-start-3">
                  <ProgressBar
                    value={course.completedLessonCount}
                    max={course.lessonCount}
                    label={`Progress ${course.title}`}
                  />
                </div>
              </div>
              <Link
                href={course.action.href}
                aria-describedby={titleId}
                className={cn(
                  buttonVariants({ variant: "secondary" }),
                  "mt-3 w-full sm:mt-0 sm:w-full",
                )}
              >
                {course.action.kind === "mulai"
                  ? "Mulai materi 1"
                  : "Lanjutkan"}
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** "Kursus lainnya" rows (28a right column): every remaining available
 *  course, each with its own start button — a deliberate deviation from
 *  28a's button-less rows (card §3.E: without it only the featured course
 *  could be started before the S6 catalog exists). */
function KursusLainnya({ courses }: { courses: LearnerCourseDTO[] }) {
  return (
    <section
      aria-labelledby="kursus-lainnya-heading"
      className="rounded-card border border-border bg-surface p-5"
    >
      <h2
        id="kursus-lainnya-heading"
        className="text-lg font-black tracking-tight text-text"
      >
        Kursus lainnya
      </h2>
      <div className="mt-4 flex flex-col gap-5">
        {courses.map((course) => {
          const titleId = `kursus-lainnya-${course.id}`;
          return (
            <article
              key={course.id}
              aria-labelledby={titleId}
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
                  {course.levelLabel.toUpperCase()} · {course.lessonCount}{" "}
                  MATERI
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
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** The shared right column: "Kursus lainnya" plus, for a NEW participant
 *  with something to start (state A only), the 28a "Nilai Saya masih
 *  kosong" box — state C shows nothing on the right: it is not the first
 *  day the copy speaks to, and there is no stats widget for the demo
 *  (card §3.B). */
function RightColumn({
  others,
  showNilaiKosong,
}: {
  others: LearnerCourseDTO[];
  showNilaiKosong: boolean;
}) {
  if (others.length === 0 && !showNilaiKosong) return null;
  return (
    <div className="flex flex-col gap-7">
      {others.length > 0 ? <KursusLainnya courses={others} /> : null}
      {showNilaiKosong ? (
        <div className="hidden rounded-card border border-dashed border-border-dashed bg-surface-2 p-5 sm:block">
          <h2 className="text-lg font-black tracking-tight text-text">
            Nilai Saya masih kosong
          </h2>
          <p className="mt-2 text-sm text-text-muted">
            Statistik belajar muncul setelah quiz pertama Anda selesai.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function LearnDashboard({ firstName, dashboard }: LearnDashboardProps) {
  const isNewParticipant = dashboard.enrolled.length === 0;
  // State A: the featured course is available[0] and must not repeat in
  // "Kursus lainnya" (card §3.D). State B: no featured card, so the whole
  // available list is "lainnya".
  const others = isNewParticipant
    ? dashboard.available.slice(1)
    : dashboard.available;
  const greeting = isNewParticipant ? "Selamat datang" : "Selamat datang kembali";

  return (
    <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        {/* Typography from A-14b, but with wrap-anywhere instead of its
            break-words/text-balance: a single-word 40-character name (or a
            70-character course title below) has no break point, and
            break-word variants do not shrink the min-content width — the
            no-horizontal-scroll suite caught exactly that. Same utility the
            CMS course list and rich-content already use. */}
        <h1 className="wrap-anywhere text-[25px] font-black leading-[1.14] tracking-[-0.022em] text-text sm:text-[32px] sm:leading-[1.16] sm:tracking-[-0.024em]">
          {firstName ? `${greeting}, ${firstName}` : greeting}
        </h1>

        {isNewParticipant ? (
          dashboard.available.length > 0 ? (
            <>
              {/* Intro copy: 28a ≥ 640, 28b below (card §3.A). */}
              <p className="mt-4 max-w-(--width-measure) text-text-muted sm:hidden">
                Belum ada kursus. Mulai dari yang paling dasar:
              </p>
              <p className="mt-4 hidden max-w-(--width-measure) text-text-muted sm:block">
                Belum ada kursus yang Anda ikuti. Pilih satu untuk mulai —
                setiap materi 3–5 menit dan progress tersimpan otomatis.
              </p>
              <FeaturedCard course={dashboard.available[0]!} />
              <HowItWorks />
            </>
          ) : (
            // State C: nothing published (and nothing enrolled). Only the
            // component test can reach it — the shared e2e database always
            // has published courses.
            <EmptyState
              className="mt-8"
              label="KURSUS · BELUM ADA"
              title="Belum ada kursus yang terbit"
              description="Kursus pertama sedang disiapkan ahli gizi."
              primaryAction={{
                label: "Tanya Ahli Gizi",
                href: "/#tanya-ahli-gizi",
              }}
              alternativeAction={{ label: "Kembali ke Beranda", href: "/" }}
            />
          )
        ) : (
          <KursusSaya courses={dashboard.enrolled} />
        )}
      </div>
      <RightColumn
        others={others}
        showNilaiKosong={isNewParticipant && dashboard.available.length > 0}
      />
    </div>
  );
}
