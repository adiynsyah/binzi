/*
 * /cms/konten approval queue (card S1-08 §6, screen 19d left column): one
 * row per IN_REVIEW course — mono eyebrow "KURSUS · {peninjau} · {waktu}",
 * the course title as the link into its builder. Deliberately a SERVER
 * component (owner review 10): nothing here is interactive beyond plain
 * links, so no "use client" boundary ships.
 *
 * Two empty states: the plain queue ("Tidak ada kursus…") and the
 * "Perlu revisi" variant — NEEDS_REVISION ships after the demo (PRD v1.6),
 * so that view is the empty state for now.
 */
import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { formatWib } from "@/lib/datetime";
import type { CourseApprovalQueueItemDTO } from "@/modules/course/service";

export type ApprovalQueueProps = {
  /** Optional for the perlu-revisi variant, which renders no rows yet. */
  items?: CourseApprovalQueueItemDTO[];
  /** "perlu-revisi": the revision view — empty until NEEDS_REVISION ships. */
  variant?: "queue" | "perlu-revisi";
};

/** Eyebrow "KURSUS · {peninjau} · {waktu}"; null reviewer → the card copy. */
function eyebrowOf(item: CourseApprovalQueueItemDTO): string {
  const reviewer = item.reviewerName ?? "PENGGARAP BELUM TERCATAT";
  const waktu = item.reviewedAt ? formatWib(new Date(item.reviewedAt)) : "—";
  return `KURSUS · ${reviewer} · ${waktu}`;
}

export function ApprovalQueue({
  items = [],
  variant = "queue",
}: ApprovalQueueProps) {
  if (variant === "perlu-revisi") {
    return (
      <div className="mt-6">
        <EmptyState
          label="KONTEN"
          title="Belum ada konten yang perlu direvisi."
          primaryAction={{ label: "Buka daftar kursus", href: "/cms/kursus" }}
          alternativeAction={{ label: "Kembali ke Ringkasan", href: "/cms" }}
        />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mt-6">
        <EmptyState
          label="KURSUS"
          title="Tidak ada kursus yang menunggu persetujuan."
          primaryAction={{ label: "Buka daftar kursus", href: "/cms/kursus" }}
          alternativeAction={{ label: "Kembali ke Ringkasan", href: "/cms" }}
        />
      </div>
    );
  }

  return (
    <section className="mt-6">
      {/* Count pill (19d): the queue length, oldest first. */}
      <span className="inline-block rounded-pill border border-border bg-surface px-3 py-1 font-mono text-xs text-text-muted">
        {items.length} menunggu
      </span>
      <ul className="mt-3 flex flex-col divide-y divide-border-soft rounded-card border border-border bg-surface">
        {items.map((item) => (
          <li key={item.id} className="px-4 py-3 sm:px-6">
            <p className="font-mono text-xs uppercase tracking-wide text-text-subtle wrap-anywhere">
              {eyebrowOf(item)}
            </p>
            {/* ≥ 44px touch target; wrap-anywhere so a no-space title can
                never push the page sideways (A-19b). */}
            <Link
              href={`/cms/kursus/${item.id}`}
              className="mt-1 flex min-h-11 items-center wrap-anywhere text-base font-bold text-text"
            >
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
