// Input contracts for the recovery module (card S3-03 §2) — pure Zod, safe
// to import from client forms (src/modules/README.md). Copy marked
// "(usulan)" in the card is listed in the PR.
import { z } from "zod";

export const REPORT_CATEGORIES = [
  "SUBMIT_ERROR",
  "TIMER_ENDED_EARLY",
  "CONTENT_MISSING",
  "OTHER",
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/** Category labels (7i copy) — the participant form and the CMS share them. */
export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  SUBMIT_ERROR: "Halaman error saat mengirim jawaban",
  TIMER_ENDED_EARLY: "Timer habis padahal baru mulai",
  CONTENT_MISSING: "Soal atau pilihan jawaban tidak tampil",
  OTHER: "Lainnya",
};

export const REPORT_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

const reasonField = z
  .string()
  .trim()
  .min(10, "Alasan minimal 10 karakter.")
  .max(1000, "Maksimal 1000 karakter.");

/** Optional staff-only note; an empty box is "no note". */
const internalNoteField = z
  .string()
  .trim()
  .max(1000, "Maksimal 1000 karakter.")
  .optional()
  .transform((value) => (value === undefined || value === "" ? undefined : value));

export const createReportInput = z.strictObject({
  category: z.enum(REPORT_CATEGORIES, {
    error: "Pilih apa yang terjadi.",
  }),
  description: z
    .string()
    .trim()
    .min(20, "Ceritakan minimal 20 karakter.")
    .max(1000, "Maksimal 1000 karakter."),
});

export const decideReportInput = z.strictObject({
  decision: z.enum(["APPROVE", "REJECT"], { error: "Pilih keputusan." }),
  reason: reasonField,
  internalNote: internalNoteField,
});

export const manualResetInput = z.strictObject({
  reason: reasonField,
  internalNote: internalNoteField,
});

/** The queue tab (`?status=` is mapped onto this by the page). */
export const listReportsInput = z.strictObject({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "ALL"]),
});

/** Exact-email lookup for the manual reset (decision 8). */
export const findUserInput = z.strictObject({
  email: z.string().trim().min(1).max(254),
});

export type CreateReportInput = z.infer<typeof createReportInput>;
export type DecideReportInput = z.infer<typeof decideReportInput>;
export type ManualResetInput = z.infer<typeof manualResetInput>;
export type ListReportsInput = z.infer<typeof listReportsInput>;
