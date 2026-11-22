// CourseCatalog (card S6-02 §3) — the /kursus grid over the public catalog
// DTO: every PUBLISHED course with at least one lesson. Server component,
// pure render; the page supplies the data (force-dynamic).
//
// Layout (7a/7f/7t): one column < 640, two columns 640–1023 — where the
// LAST card of an odd count widens into a two-column row with the cover on
// the left (7t) — and three columns ≥ 1024. Every card is an
// <article aria-labelledby> with a DETERMINISTIC id built from the slug
// (structure rule from learn-dashboard.tsx), and the repeated "Lihat
// kursus" link names its card via aria-describedby (WCAG 2.5.3).
//
// The cover meta is DOM-lowercase mono uppercased by CSS (the my-courses
// pattern) — e2e asserts "2 materi · 12 menit".

import Link from "next/link";

import { CoverBlock } from "@/components/learn/learn-dashboard";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import type { PublicCourseCardDTO } from "@/modules/course/service";

export type CourseCatalogProps = {
  courses: PublicCourseCardDTO[];
};

/** The mono eyebrow — the same class Nilai Saya and Kursus Saya use, kept
 *  local so nothing in (public) imports from the learn folder for a class. */
const EYEBROW_CLASS =
  "font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-subtle";

function coverMetaText(course: PublicCourseCardDTO): string {
  return `${course.lessonCount} materi${
    course.estimatedMinutes === null ? "" : ` · ${course.estimatedMinutes} menit`
  }`;
}

/** One catalog card (7a/7f). `wide` is set ONLY on the last card of an odd
 *  count: at 640–1023 it spans both columns as a row with the cover on the
 *  left (7t); at ≥ 1024 (3 columns) and < 640 it renders like any other
 *  card. */
function CatalogCard({
  course,
  wide,
}: {
  course: PublicCourseCardDTO;
  wide: boolean;
}) {
  const titleId = `kursus-katalog-${course.slug}`;
  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "flex flex-col overflow-hidden rounded-card border border-border bg-surface",
        wide &&
          "sm:col-span-2 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] lg:col-span-1 lg:flex lg:flex-col",
      )}
    >
      <CoverBlock className="relative min-h-[130px] lg:min-h-[170px]">
        <p className="absolute bottom-3 left-3 font-mono text-xs font-medium uppercase tracking-wide text-surface">
          {coverMetaText(course)}
        </p>
      </CoverBlock>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[13px] font-bold text-text-muted">
          {course.levelLabel} · {course.lessonCount} materi
        </p>
        <h2
          id={titleId}
          className="mt-2 wrap-anywhere text-[19px] font-black leading-[1.3] tracking-[-0.012em] text-text"
        >
          {course.title}
        </h2>
        {course.summary !== null ? (
          <p className="mt-2 text-sm text-text-muted">{course.summary}</p>
        ) : null}
        <Link
          href={course.href}
          aria-describedby={titleId}
          className={cn(buttonVariants({ variant: "secondary" }), "mt-4 w-full")}
        >
          Lihat kursus
        </Link>
      </div>
    </article>
  );
}

export function CourseCatalog({ courses }: CourseCatalogProps) {
  // 640–1023: an odd count would leave the last card alone in the
  // 2-column grid — it widens into a row instead (7t).
  const widenLast = courses.length % 2 === 1;
  return (
    <>
      <p className={EYEBROW_CLASS}>Beranda / Kursus</p>
      <h1 className="mt-2 text-[28px] font-black leading-[1.12] tracking-[-0.028em] text-text sm:text-[34px] lg:text-[40px]">
        Kursus gizi yang ditinjau ahli
      </h1>
      {courses.length > 0 ? (
        <>
          <p className="mt-4 max-w-(--width-measure) text-text-muted">
            {courses.length} kursus tersedia. Setiap materi singkat dan
            ditutup satu quiz dengan pembahasan.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course, index) => (
              <CatalogCard
                key={course.slug}
                course={course}
                wide={widenLast && index === courses.length - 1}
              />
            ))}
          </div>
        </>
      ) : (
        // Exact state-C copy of LearnDashboard (owner decision, 22 Nov):
        // no new copy for the empty catalog.
        <div className="mt-8">
          <EmptyState
            label="KURSUS · BELUM ADA"
            title="Belum ada kursus yang terbit"
            description="Kursus pertama sedang disiapkan ahli gizi."
            primaryAction={{
              label: "Tanya Ahli Gizi",
              href: "/#tanya-ahli-gizi",
            }}
            alternativeAction={{ label: "Kembali ke Beranda", href: "/" }}
          />
        </div>
      )}
    </>
  );
}
