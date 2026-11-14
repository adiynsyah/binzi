// LessonCourseBar (card S2-01 §4.A) — the course context strip above every
// lesson page state (owner decision 1: replaces the 7d/7f/7t focus
// header). Below 640 it stacks: the "← Belajar" + title row, then the
// progress row; ≥ 640 one row with the progress on the right.
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ProgressBar } from "@/components/ui/progress-bar";

export function LessonCourseBar({
  title,
  progress,
}: {
  title: string;
  /** null in the not-enrolled state — no progress exists yet. */
  progress: { completed: number; total: number } | null;
}) {
  return (
    <div className="border-b border-border-soft">
      <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/belajar"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-semibold text-text"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Belajar
          </Link>
          <p className="min-w-0 wrap-anywhere text-[14.5px] font-bold text-text">
            {title}
          </p>
        </div>
        {progress ? (
          <div className="flex items-center gap-3 sm:ml-auto sm:shrink-0">
            <ProgressBar
              className="w-44 shrink-0"
              value={progress.completed}
              max={progress.total}
              label={`Progress kursus ${title}`}
            />
            <span className="shrink-0 font-mono text-xs font-medium text-text-meta">
              {progress.completed}/{progress.total} SELESAI
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
