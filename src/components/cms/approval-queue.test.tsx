// @vitest-environment jsdom
import "../ui/test-env";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApprovalQueue } from "./approval-queue";
import type { CourseApprovalQueueItemDTO } from "@/modules/course/service";

// Card S1-08 §6 "Selesai jika": rows (eyebrow, link, WIB time from a UTC
// ISO), the "{n} menunggu" pill, both empty states, and the perlu-revisi
// variant.

function itemFixture(
  overrides: Partial<CourseApprovalQueueItemDTO> = {},
): CourseApprovalQueueItemDTO {
  return {
    id: "c-1",
    title: "Dasar Gizi Ibu Hamil",
    reviewerName: "Editor Toka",
    reviewedAt: "2026-10-28T03:00:00.000Z", // 10.00 WIB same day
    ...overrides,
  };
}

describe("ApprovalQueue", () => {
  it("renders rows: eyebrow with reviewer + WIB time, title as builder link", () => {
    const second = itemFixture({
      id: "c-2",
      title: "Kursus Kedua Netral",
      reviewerName: "Editor Beta",
      reviewedAt: "2026-10-28T17:05:00.000Z", // 29 Okt, 00.05 WIB
    });
    render(<ApprovalQueue items={[itemFixture(), second]} />);

    // WIB conversion from UTC ISO (formatWib, Asia/Jakarta).
    expect(
      screen.getByText("KURSUS · Editor Toka · 28 Okt 2026 10.00 WIB"),
    ).toBeTruthy();
    expect(
      screen.getByText("KURSUS · Editor Beta · 29 Okt 2026 00.05 WIB"),
    ).toBeTruthy();

    const first = screen.getByRole("link", { name: "Dasar Gizi Ibu Hamil" });
    expect(first.getAttribute("href")).toBe("/cms/kursus/c-1");
    expect(
      screen.getByRole("link", { name: "Kursus Kedua Netral" }).getAttribute("href"),
    ).toBe("/cms/kursus/c-2");
    // The count pill names the queue length.
    expect(screen.getByText("2 menunggu")).toBeTruthy();
  });

  it("null reviewer and null reviewed_at keep the row visible with the legacy eyebrow", () => {
    const legacyRow = itemFixture({ reviewerName: null, reviewedAt: null });
    render(<ApprovalQueue items={[legacyRow]} />);

    expect(
      screen.getByText("KURSUS · PENGGARAP BELUM TERCATAT · —"),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Dasar Gizi Ibu Hamil" }),
    ).toBeTruthy();
  });

  it("empty queue: the empty state copy with a way out", () => {
    render(<ApprovalQueue items={[]} />);

    expect(
      screen.getByText("Tidak ada kursus yang menunggu persetujuan."),
    ).toBeTruthy();
    expect(screen.queryByText(/menunggu$/)).toBeNull();
    expect(
      screen.getByRole("link", { name: "Buka daftar kursus" }).getAttribute("href"),
    ).toBe("/cms/kursus");
  });

  it("perlu-revisi variant: its own empty copy, never the queue copy", () => {
    render(<ApprovalQueue items={[]} variant="perlu-revisi" />);

    expect(
      screen.getByText("Belum ada konten yang perlu direvisi."),
    ).toBeTruthy();
    expect(
      screen.queryByText("Tidak ada kursus yang menunggu persetujuan."),
    ).toBeNull();
  });
});
