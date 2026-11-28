// @vitest-environment jsdom
import "../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ManualQuizItemDTO } from "@/modules/recovery/service";

import { ResetAttemptManual } from "./reset-attempt-manual";

// Card S3-03 §6 (26c): the GET email form, not-found copy, the user card
// with "Ganti", disabled rows WITH their reason, no preselected attempt,
// the pending-report warning for the chosen row, and success → Banner +
// reset + refresh.

const mockRouter = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => mockRouter }));

const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const FINAL_ID = "3f2c8f4e-8b1a-4c8e-9a51-0d6c2e7b9a10";
const LESSON_ID = "6a1d7c2e-1b3a-4f5e-8d9c-0e1f2a3b4c5d";
const REASON = "Keluhan masuk lewat jalur resmi.";

const quizzes: ManualQuizItemDTO[] = [
  {
    quizId: "q-final",
    attemptId: FINAL_ID,
    label: "Kursus Netral · Final Quiz",
    meta: "Nilai 45 · 18 Sep 2026 · Waktu habis",
    selectable: true,
    blockedReason: null,
    blockedLabel: null,
    pendingReportNumber: 2284,
  },
  {
    quizId: "q-3",
    attemptId: LESSON_ID,
    label: "Kursus Netral · Materi 3",
    meta: "Nilai 80 · 16 Sep 2026 · Selesai normal",
    selectable: true,
    blockedReason: null,
    blockedLabel: null,
    pendingReportNumber: null,
  },
  {
    quizId: "q-2",
    attemptId: null,
    label: "Kursus Netral · Materi 2",
    meta: "Sudah pernah direset 1× · 10 Sep 2026",
    selectable: false,
    blockedReason: "ALREADY_RESET",
    blockedLabel: "Sudah pernah direset 1× · 10 Sep 2026",
    pendingReportNumber: null,
  },
  {
    quizId: "q-1",
    attemptId: "9b8c7d6e-5f4a-4b3c-8d2e-1f0a9b8c7d6e",
    label: "Kursus Netral · Materi 1",
    meta: "Nilai 70 · 9 Sep 2026 · Selesai normal",
    selectable: false,
    blockedReason: "FINAL_TAKEN",
    blockedLabel: "Final Quiz kursus ini sudah dimulai — reset Final dulu",
    pendingReportNumber: null,
  },
];

const found = {
  found: true as const,
  email: "bagas@example.com",
  user: { name: "Bagas Netral", email: "bagas@example.com" },
  quizzes,
};

const radio = (name: RegExp) => screen.getByRole("radio", { name }) as HTMLInputElement;

describe("ResetAttemptManual", () => {
  it("no email yet: GET form on Email pengguna, no result copy", () => {
    render(<ResetAttemptManual lookup={null} />);
    const input = screen.getByLabelText("Email pengguna") as HTMLInputElement;
    expect(input.name).toBe("email");
    const form = input.closest("form")!;
    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toBe("/cms/reset-attempt/baru");
    expect(screen.queryByText("Tidak ada pengguna dengan email ini.")).toBeNull();
  });

  it("not found: the copy, the email kept in the box", () => {
    render(<ResetAttemptManual lookup={{ found: false, email: "x@example.com" }} />);
    expect(screen.getByText("Tidak ada pengguna dengan email ini.")).toBeTruthy();
    expect((screen.getByLabelText("Email pengguna") as HTMLInputElement).value).toBe(
      "x@example.com",
    );
  });

  it("found: user card + Ganti, rows disabled with their reason, nothing preselected", () => {
    render(<ResetAttemptManual lookup={found} />);
    expect(screen.getByText("Bagas Netral")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ganti" }).getAttribute("href")).toBe(
      "/cms/reset-attempt/baru",
    );
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.some((item) => item.checked)).toBe(false);
    expect(radio(/^Kursus Netral · Final Quiz/).disabled).toBe(false);
    expect(radio(/^Kursus Netral · Materi 2/).disabled).toBe(true);
    expect(radio(/^Kursus Netral · Materi 1/).disabled).toBe(true);
    expect(screen.getAllByText("Sudah pernah direset 1× · 10 Sep 2026")).toHaveLength(1);
    expect(
      screen.getByText("Final Quiz kursus ini sudah dimulai — reset Final dulu"),
    ).toBeTruthy();
  });

  it("the pending-report warning shows for the chosen row only, linking the report", () => {
    render(<ResetAttemptManual lookup={found} />);
    expect(screen.queryByText(/laporan menunggu/)).toBeNull();
    fireEvent.click(radio(/^Kursus Netral · Final Quiz/));
    expect(screen.getByText(/User ini punya laporan menunggu untuk attempt yang sama/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "R-2284" }).getAttribute("href")).toBe(
      "/cms/reset-attempt/2284",
    );
    fireEvent.click(radio(/^Kursus Netral · Materi 3/));
    expect(screen.queryByText(/laporan menunggu/)).toBeNull();
  });

  it("no attempt chosen → group error, no fetch", async () => {
    render(<ResetAttemptManual lookup={found} />);
    fireEvent.change(screen.getByLabelText(/Alasan untuk user/), { target: { value: REASON } });
    fireEvent.click(screen.getByRole("button", { name: "Reset attempt" }));
    expect(await screen.findByText("Pilih attempt yang direset.")).toBeTruthy();
    expect(
      screen.getByRole("group", { name: "Pilih attempt yang direset" }).getAttribute("aria-invalid"),
    ).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sukses → exact POST, Banner Attempt direset., reset (kosong lagi), refresh", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    render(<ResetAttemptManual lookup={found} />);
    fireEvent.click(radio(/^Kursus Netral · Materi 3/));
    fireEvent.change(screen.getByLabelText(/Alasan untuk user/), { target: { value: REASON } });
    fireEvent.click(screen.getByRole("button", { name: "Reset attempt" }));
    expect(await screen.findByText("Attempt direset.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(`/api/cms/reset-attempt/attempts/${LESSON_ID}/reset`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: REASON }),
    });
    expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect((screen.getByLabelText(/Alasan untuk user/) as HTMLTextAreaElement).value).toBe(""),
    );
    expect(radio(/^Kursus Netral · Materi 3/).checked).toBe(false);
  });
});
