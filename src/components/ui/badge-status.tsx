import { cn } from "../../lib/utils";

/*
 * Status badge (card A-05, screen 16c): ONE shape — a fully rounded pill;
 * only the color changes. Usage rules from 16c: "Lulus" REPLACES
 * "Selesai" (never stacked) and "Siklus ke-n" always appears BESIDE the
 * status badge — the page composes them; this component renders one pill.
 *
 * Colors map to tokens. 16c draws "Selesai" on a slate blue that has no
 * token in TOKENS.md, so it uses the nearest neutral pair (noted in the
 * PR). Text on the solid "Lulus" green is `surface`, never text-white.
 */

export type BadgeStatusType =
  | "belum-dimulai"
  | "sedang-berjalan"
  | "selesai"
  | "lulus"
  | "menunggu-persetujuan"
  | "siklus";

const badgeStyles = {
  "belum-dimulai": "bg-surface-2 text-text-meta",
  "sedang-berjalan": "bg-primary-tint text-primary-deep",
  selesai: "bg-fill text-text-muted",
  lulus: "bg-success text-surface",
  "menunggu-persetujuan": "bg-pending-tint text-pending-tint-text",
} as const satisfies Record<Exclude<BadgeStatusType, "siklus">, string>;

const badgeLabels = {
  "belum-dimulai": "Belum dimulai",
  "sedang-berjalan": "Sedang berjalan",
  selesai: "Selesai",
  lulus: "Lulus",
  "menunggu-persetujuan": "Menunggu persetujuan",
} as const satisfies Record<Exclude<BadgeStatusType, "siklus">, string>;

export type BadgeStatusProps = {
  status: BadgeStatusType;
  /** Cycle number; required when status="siklus" → "Siklus ke-2". */
  cycle?: number;
  className?: string;
};

export function BadgeStatus({ status, cycle, className }: BadgeStatusProps) {
  if (status === "siklus" && (cycle === undefined || cycle < 1)) {
    throw new Error('BadgeStatus: status "siklus" requires cycle >= 1');
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-3 py-1 text-xs font-bold",
        status === "siklus"
          ? "bg-cycle-tint text-cycle-tint-text"
          : badgeStyles[status],
        className,
      )}
    >
      {status === "siklus" ? `Siklus ke-${cycle}` : badgeLabels[status]}
    </span>
  );
}
