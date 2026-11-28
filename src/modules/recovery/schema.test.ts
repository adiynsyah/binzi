// Card S3-03: the recovery input contracts — the same Zod objects the client
// forms resolve with, so these rules hold on both sides.
import { describe, expect, it } from "vitest";

import {
  REPORT_CATEGORY_LABELS,
  createReportInput,
  decideReportInput,
  manualResetInput,
} from "./schema";

describe("createReportInput", () => {
  it("cerita di-trim; < 20 karakter ditolak, 20 diterima, > 1000 ditolak", () => {
    expect(
      createReportInput.safeParse({ category: "OTHER", description: `  ${"a".repeat(19)}  ` })
        .error?.issues[0]?.message,
    ).toBe("Ceritakan minimal 20 karakter.");
    expect(
      createReportInput.parse({ category: "OTHER", description: `  ${"a".repeat(20)}  ` }),
    ).toEqual({ category: "OTHER", description: "a".repeat(20) });
    expect(
      createReportInput.safeParse({ category: "OTHER", description: "a".repeat(1001) })
        .error?.issues[0]?.message,
    ).toBe("Maksimal 1000 karakter.");
  });

  it("kategori wajib dan hanya empat nilai; kunci asing ditolak", () => {
    expect(
      createReportInput.safeParse({ description: "a".repeat(30) }).error?.issues[0]
        ?.message,
    ).toBe("Pilih apa yang terjadi.");
    expect(
      createReportInput.safeParse({ category: "LAIN", description: "a".repeat(30) })
        .success,
    ).toBe(false);
    expect(
      createReportInput.safeParse({
        category: "OTHER",
        description: "a".repeat(30),
        userId: "u-1",
      }).success,
    ).toBe(false);
  });

  it("label kategori sesuai copy 7i", () => {
    expect(REPORT_CATEGORY_LABELS).toEqual({
      SUBMIT_ERROR: "Halaman error saat mengirim jawaban",
      TIMER_ENDED_EARLY: "Timer habis padahal baru mulai",
      CONTENT_MISSING: "Soal atau pilihan jawaban tidak tampil",
      OTHER: "Lainnya",
    });
  });
});

describe("decideReportInput", () => {
  it("alasan < 10 karakter ditolak", () => {
    expect(
      decideReportInput.safeParse({ decision: "APPROVE", reason: "  pendek  " }).error
        ?.issues[0]?.message,
    ).toBe("Alasan minimal 10 karakter.");
    // Exactly 10 characters after trim → accepted.
    expect(
      decideReportInput.parse({ decision: "REJECT", reason: "  0123456789  " }),
    ).toEqual({ decision: "REJECT", reason: "0123456789", internalNote: undefined });
  });

  it("keputusan wajib; catatan internal kosong = tidak ada catatan", () => {
    expect(
      decideReportInput.safeParse({ reason: "Alasan yang cukup panjang." }).error
        ?.issues[0]?.message,
    ).toBe("Pilih keputusan.");
    expect(
      decideReportInput.parse({
        decision: "APPROVE",
        reason: "Alasan yang cukup panjang.",
        internalNote: "   ",
      }).internalNote,
    ).toBeUndefined();
    expect(
      decideReportInput.safeParse({
        decision: "APPROVE",
        reason: "Alasan yang cukup panjang.",
        internalNote: "a".repeat(1001),
      }).success,
    ).toBe(false);
  });
});

describe("manualResetInput", () => {
  it("aturan alasan sama dengan keputusan", () => {
    expect(
      manualResetInput.safeParse({ reason: "pendek" }).error?.issues[0]?.message,
    ).toBe("Alasan minimal 10 karakter.");
    expect(
      manualResetInput.parse({ reason: " Lewat WhatsApp resmi. ", internalNote: "x" }),
    ).toEqual({ reason: "Lewat WhatsApp resmi.", internalNote: "x" });
  });
});
