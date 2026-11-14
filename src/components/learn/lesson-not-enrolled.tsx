// LessonNotEnrolled (card S2-01 §4.D) — the dashed panel of the
// not-enrolled state: no content, no outline, no beacon; one primary way
// in (StartCourseButton S5-01) plus the way back. The button's
// aria-describedby points at the h2 so the course context rides along.
import Link from "next/link";

import { StartCourseButton } from "@/components/learn/start-course-button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export function LessonNotEnrolled({
  course,
  className,
}: {
  course: { id: string; title: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-card border border-dashed border-border-dashed bg-surface-2 p-6",
        className,
      )}
    >
      <p className="font-mono text-xs uppercase tracking-wide text-text-subtle">
        KURSUS · BELUM DIIKUTI
      </p>
      <h2
        id="panel-belum-mengikuti-judul"
        className="mt-2 text-xl font-black tracking-tight text-text"
      >
        Anda belum mengikuti kursus ini
      </h2>
      <p className="mt-2 max-w-(--width-measure) text-text-muted">
        Mulai kursus untuk membuka materi dan menyimpan progress Anda.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {/* Wrapper keeps the button's always-mounted alert <p> out of the
            flex gap math while it is empty. */}
        <div className="w-full sm:w-auto">
          <StartCourseButton
            courseId={course.id}
            variant="primary"
            className="w-full sm:w-auto"
            aria-describedby="panel-belum-mengikuti-judul"
          >
            Mulai materi 1
          </StartCourseButton>
        </div>
        <Link
          href="/belajar"
          className={cn(
            buttonVariants({ variant: "secondary" }),
            "w-full sm:w-auto",
          )}
        >
          Kembali ke Belajar
        </Link>
      </div>
    </div>
  );
}
