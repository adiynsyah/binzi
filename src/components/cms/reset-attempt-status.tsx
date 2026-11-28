// Report status pill + deadline text for the reset-attempt screens (card
// S3-03 §6, 26a/26b). Local on purpose: BadgeStatus has a fixed label set
// without Menunggu/Disetujui/Ditolak, and src/components/ui is out of scope
// for this card. Same one-pill shape, token pairs only.
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ReportStatus = "PENDING" | "APPROVED" | "REJECTED";

const STATUS_PILL: Record<ReportStatus, { label: string; className: string }> = {
  PENDING: { label: "Menunggu", className: "bg-pending-tint text-pending-tint-text" },
  APPROVED: { label: "Disetujui", className: "bg-success-tint text-success-tint-text" },
  REJECTED: { label: "Ditolak", className: "bg-fill text-text-muted" },
};

export function ReportStatusPill({ status }: { status: ReportStatus }) {
  const { label, className } = STATUS_PILL[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-3 py-1 text-xs font-bold",
        className,
      )}
    >
      {label}
    </span>
  );
}

/** "sisa 18 jam" in the pending pair; red (danger) when urgent (decision 9). */
export function DeadlineText({
  deadline,
  prefix,
}: {
  deadline: { label: string; urgent: boolean } | null;
  prefix?: ReactNode;
}) {
  if (deadline === null) {
    return <span className="text-sm text-text-meta">—</span>;
  }
  return (
    <span
      data-urgent={deadline.urgent ? "true" : "false"}
      className={cn(
        "text-sm font-bold",
        deadline.urgent ? "text-danger" : "text-pending-tint-text",
      )}
    >
      {prefix}
      {deadline.label}
    </span>
  );
}
