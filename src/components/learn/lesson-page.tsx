// LessonPage (card S2-01 §4) — every state of /belajar/{kursus}/{materi}
// over the LessonPageDTO: the course bar (all states), then open (7d
// content + bottom bar + outline), locked (EmptyState panel + outline),
// or not-enrolled (dashed panel, no outline). Server component — pure
// render; the gate ran in the service.
//
// "Daftar materi" is ONE component (LessonOutlineNav) rendered in TWO
// places: the ≥1024 side card (hidden lg:block) and the <1024 <details>
// (lg:hidden). Both wrappers are <nav aria-label="Daftar materi"> so the
// landmark exists at every width; the hidden one leaves the accessibility
// tree, so only one is ever exposed per width.
import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";

import { LessonCourseBar } from "@/components/learn/lesson-course-bar";
import { LessonNotEnrolled } from "@/components/learn/lesson-not-enrolled";
import { LessonOpenBeacon } from "@/components/learn/lesson-open-beacon";
import { LessonOutlineNav } from "@/components/learn/lesson-outline-nav";
import { PageContainer } from "@/components/shared/page-container";
import { RichContent } from "@/components/shared/rich-content";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import type {
  LessonOutlineItemDTO,
  LessonPageDTO,
} from "@/modules/progress/service";

const H1_CLASSES =
  "wrap-anywhere text-[22px] font-black leading-[1.22] tracking-[-0.02em] text-text sm:text-[26px]";

/** The ≥1024 "Daftar materi" card (7d right column). */
function OutlineCard({ outline }: { outline: LessonOutlineItemDTO[] }) {
  return (
    <div className="rounded-card border border-border bg-surface-2 p-5">
      <h2 className="text-[13px] font-bold text-text">Daftar materi</h2>
      <LessonOutlineNav outline={outline} className="mt-4" />
    </div>
  );
}

/** The <1024 "Daftar materi" fold (7t): summary ≥ 44px with the counts,
 *  the same LessonOutlineNav inside. */
function OutlineDetails({ outline }: { outline: LessonOutlineItemDTO[] }) {
  const completed = outline.filter((item) => item.state === "selesai").length;
  const locked = outline.filter((item) => item.state === "terkunci").length;
  return (
    <details className="rounded-card border border-border bg-surface-2">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-5 py-3 text-[13px] font-bold text-text">
        Daftar materi
        <span className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-xs font-medium text-text-meta">
            {completed} SELESAI · {locked} TERKUNCI
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-text-muted transition-transform duration-200 [details[open]_&]:rotate-180"
            aria-hidden="true"
          />
        </span>
      </summary>
      <div className="px-5 pb-5">
        <LessonOutlineNav outline={outline} className="mt-1" />
      </div>
    </details>
  );
}

type OpenDTO = Extract<LessonPageDTO, { state: "open" }>;
type LockedDTO = Extract<LessonPageDTO, { state: "locked" }>;

function OpenState({ data }: { data: OpenDTO }) {
  return (
    <div className="mt-6 grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
      <div className="min-w-0">
        <h1 className={H1_CLASSES}>
          Materi {data.lesson.position} · {data.lesson.title}
        </h1>
        <RichContent doc={data.lesson.content} className="mt-4" />
        <div className="mt-8 flex flex-wrap gap-3 border-t border-border-soft pt-5">
          {data.prevHref ? (
            <Link
              href={data.prevHref}
              className={cn(buttonVariants({ variant: "secondary" }), "gap-2")}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Materi sebelumnya
            </Link>
          ) : null}
          <div className="ml-auto flex items-center">
            {data.next?.kind === "link" ? (
              <Link
                href={data.next.href}
                className={cn(
                  buttonVariants({ variant: "secondary" }),
                  "gap-2",
                )}
              >
                Materi berikutnya
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            ) : data.next?.kind === "terkunci" ? (
              <p className="text-sm text-text-meta">
                Materi {data.next.position} terbuka setelah quiz materi ini
                dikerjakan.
              </p>
            ) : null}
          </div>
        </div>
        {/* Records "materi dibuka" after render — the GET above never
            writes (card decision). */}
        <LessonOpenBeacon lessonId={data.lesson.id} />
        <nav aria-label="Daftar materi" className="mt-8 lg:hidden">
          <OutlineDetails outline={data.outline} />
        </nav>
      </div>
      <nav aria-label="Daftar materi" className="hidden lg:block">
        <OutlineCard outline={data.outline} />
      </nav>
    </div>
  );
}

function LockedState({ data }: { data: LockedDTO }) {
  const unlock = data.unlock;
  return (
    <div className="mt-6 grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
      <div className="min-w-0">
        <h1 className={H1_CLASSES}>
          Materi {data.lesson.position} · {data.lesson.title}
        </h1>
        <EmptyState
          className="mt-6"
          label={`MATERI ${data.lesson.position} · TERKUNCI`}
          title="Materi ini belum terbuka"
          description={`Kerjakan quiz materi ${
            unlock?.position ?? data.lesson.position - 1
          } lebih dulu. Lulus atau tidak, materi berikutnya langsung terbuka.`}
          primaryAction={
            unlock
              ? { label: `Buka materi ${unlock.position}`, href: unlock.href }
              : { label: "Kembali ke Belajar", href: "/belajar" }
          }
          alternativeAction={
            unlock
              ? { label: "Kembali ke Belajar", href: "/belajar" }
              : { label: "Ke Beranda", href: "/" }
          }
        />
        <nav aria-label="Daftar materi" className="mt-8 lg:hidden">
          <OutlineDetails outline={data.outline} />
        </nav>
      </div>
      <nav aria-label="Daftar materi" className="hidden lg:block">
        <OutlineCard outline={data.outline} />
      </nav>
    </div>
  );
}

export function LessonPage({ data }: { data: LessonPageDTO }) {
  return (
    <PageContainer className="pt-6 pb-12">
      <LessonCourseBar
        title={data.course.title}
        progress={
          data.state === "not-enrolled"
            ? null
            : {
                completed: data.course.completedLessonCount,
                total: data.course.lessonCount,
              }
        }
      />
      {data.state === "open" ? (
        <OpenState data={data} />
      ) : data.state === "locked" ? (
        <LockedState data={data} />
      ) : (
        <>
          <h1 className={cn(H1_CLASSES, "mt-6")}>
            Materi {data.lesson.position} · {data.lesson.title}
          </h1>
          <LessonNotEnrolled className="mt-6" course={data.course} />
        </>
      )}
    </PageContainer>
  );
}
