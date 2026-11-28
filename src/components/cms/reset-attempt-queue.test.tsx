// @vitest-environment jsdom
import "../ui/test-env";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReportQueueDTO, ReportQueueItemDTO } from "@/modules/recovery/service";

import { ResetAttemptQueue } from "./reset-attempt-queue";

// Card S3-03 §6 (26a): tabs with counts and `?status=` navigation, each
// report as ONE link named with reporter + number, the deadline red only
// when urgent, the empty tab copy, and no design annotation in the text.

const mockRouter = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => mockRouter }));

beforeEach(() => vi.clearAllMocks());

function item(overrides: Partial<ReportQueueItemDTO> = {}): ReportQueueItemDTO {
  return {
    number: 2291,
    status: "PENDING",
    reporterName: "Rina Netral",
    createdAt: "19 Sep 2026 14.09 WIB",
    quizLabel: "Kursus Netral · Materi 2",
    scorePercent: 33,
    answered: 2,
    total: 3,
    categoryLabel: "Halaman error saat mengirim jawaban",
    deadline: { label: "sisa 18 jam", urgent: false },
    ...overrides,
  };
}

const data: ReportQueueDTO = {
  counts: { PENDING: 2, APPROVED: 14, REJECTED: 5, ALL: 21 },
  items: [
    item(),
    item({
      number: 2284,
      reporterName: "Bagas Netral",
      deadline: { label: "sisa 4 jam", urgent: true },
    }),
  ],
};

describe("ResetAttemptQueue", () => {
  it("header: eyebrow, one h1, paragraph without the § annotation, Reset tanpa laporan link", () => {
    render(<ResetAttemptQueue data={data} active="menunggu" />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Reset attempt");
    expect(screen.getByText("Pengaturan / Reset attempt")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/§|\([A-Z]{1,4}-[0-9]+\)/);
    expect(
      screen.getByRole("link", { name: "Reset tanpa laporan…" }).getAttribute("href"),
    ).toBe("/cms/reset-attempt/baru");
  });

  it("tabs show the counts; choosing a tab navigates to ?status=", () => {
    render(<ResetAttemptQueue data={data} active="menunggu" />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Menunggu2",
      "Disetujui14",
      "Ditolak5",
      "Semua21",
    ]);
    expect(tabs[0]!.getAttribute("aria-selected")).toBe("true");
    fireEvent.mouseDown(tabs[2]!);
    fireEvent.click(tabs[2]!);
    fireEvent.keyDown(tabs[2]!, { key: "Enter" });
    expect(mockRouter.push).toHaveBeenCalledWith("/cms/reset-attempt?status=ditolak");
  });

  it("every row is one link to its review page, named with reporter + number", () => {
    render(<ResetAttemptQueue data={data} active="menunggu" />);
    const link = screen.getByRole("link", { name: /Rina Netral.*R-2291/ });
    expect(link.getAttribute("href")).toBe("/cms/reset-attempt/2291");
    expect(within(link).getByText("Nilai 33 · Soal 2/3")).toBeTruthy();
    expect(within(link).getByText("Kursus Netral · Materi 2")).toBeTruthy();
    expect(within(link).getByText("Menunggu")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Bagas Netral.*R-2284/ }).getAttribute("href"),
    ).toBe("/cms/reset-attempt/2284");
  });

  it("deadline is red (danger) only when urgent; decided rows show —", () => {
    render(
      <ResetAttemptQueue
        data={{
          ...data,
          items: [
            ...data.items,
            item({ number: 2270, status: "REJECTED", deadline: null }),
          ],
        }}
        active="semua"
      />,
    );
    const calm = screen.getByText(/sisa 18 jam/);
    const urgent = screen.getByText(/sisa 4 jam/);
    expect(calm.className).not.toContain("text-danger");
    expect(urgent.className).toContain("text-danger");
    const decided = screen.getByRole("link", { name: /R-2270/ });
    expect(within(decided).getByText("—")).toBeTruthy();
    expect(within(decided).getByText("Ditolak")).toBeTruthy();
  });

  it("a long no-space reporter name keeps the avatar from shrinking", () => {
    const longName = "k".repeat(60);
    render(
      <ResetAttemptQueue data={{ ...data, items: [item({ reporterName: longName })] }} active="menunggu" />,
    );
    const name = screen.getByText(longName);
    expect(name.className).toContain("wrap-anywhere");
    const avatar = name.closest("div.flex")!.querySelector("[aria-hidden]")!;
    expect(avatar.className).toContain("shrink-0");
  });

  it("empty tab copy", () => {
    render(<ResetAttemptQueue data={{ ...data, items: [] }} active="disetujui" />);
    expect(screen.getByText("Tidak ada laporan di tab ini.")).toBeTruthy();
  });
});
