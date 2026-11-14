// LessonOutlineNav (card S2-01 §4.B) — the <ol> of course lessons, one
// component rendered in BOTH "Daftar materi" places (the ≥1024 side card
// and the <1024 <details>). Server component; the gate decided the states
// server-side, "terkunci" rows are plain text (never links).
import Link from "next/link";
import { Check, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import type { LessonOutlineItemDTO } from "@/modules/progress/service";

const ROW_CLASSES =
  "flex min-h-11 items-center gap-2.5 rounded-control border px-3";
const LABEL_CLASSES = "min-w-0 text-[13.5px] font-semibold wrap-anywhere";

/** The 22px round state icon (7d). `primary` on non-text elements only. */
function StateIcon({ state }: { state: LessonOutlineItemDTO["state"] }) {
  if (state === "selesai") {
    return (
      <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-success">
        <Check className="size-3 text-surface" aria-hidden="true" />
      </span>
    );
  }
  if (state === "kini") {
    return (
      <span
        className="size-[22px] shrink-0 rounded-full border-2 border-primary"
        aria-hidden="true"
      />
    );
  }
  if (state === "terkunci") {
    return (
      <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-fill">
        <Lock className="size-3 text-text-meta" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span
      className="size-[22px] shrink-0 rounded-full bg-fill"
      aria-hidden="true"
    />
  );
}

export function LessonOutlineNav({
  outline,
  className,
}: {
  outline: LessonOutlineItemDTO[];
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-col gap-2", className)}>
      {outline.map((item) => {
        const isKini = item.state === "kini";
        if (item.state === "terkunci") {
          return (
            <li key={item.position}>
              <p
                className={cn(
                  ROW_CLASSES,
                  "border-border-soft bg-surface text-text-muted",
                )}
              >
                <StateIcon state="terkunci" />
                <span className={LABEL_CLASSES}>
                  {item.position} · {item.title}
                </span>
                <span className="sr-only"> (terkunci)</span>
              </p>
            </li>
          );
        }
        return (
          <li key={item.position}>
            <Link
              href={item.href ?? "#"}
              aria-current={isKini ? "page" : undefined}
              className={cn(
                ROW_CLASSES,
                "border-border-soft bg-surface",
                item.state === "terbuka" ? "text-text-muted" : "text-text",
                // tailwind-merge REPLACES the border width/color and the
                // background of the base row — they never coexist (owner
                // review of this card).
                isKini && "border-[1.5px] border-primary/30 bg-primary-tint",
              )}
            >
              <StateIcon state={item.state} />
              <span className={cn(LABEL_CLASSES, isKini && "font-bold")}>
                {item.position} · {item.title}
              </span>
              {isKini ? (
                <span className="ml-auto shrink-0 text-xs font-semibold text-primary-deep">
                  kini
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
