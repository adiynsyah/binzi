// @vitest-environment jsdom
import "../ui/test-env";

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReportReviewDTO } from "@/modules/recovery/service";

import { ResetAttemptReview } from "./reset-attempt-review";

// Card S3-03 §6 (26b) + owner decision 28 Nov: nothing preselected; the
// button reads "Simpan keputusan" (dark) until a choice, then "Setujui &
// reset attempt" / "Tolak laporan"; submitting without a choice → group
// error + focus on the first radio + no fetch; the consequence list only
// for "Setujui"; reason required (≥ 10); 409 → Banner with the server
// message; success → reset + refresh; a decided report is read-only.

const mockRouter = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => mockRouter }));

const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const REASON = "Catatan sistem mendukung laporan ini.";

const pending: ReportReviewDTO = {
  number: 2291,
  status: "PENDING",
  deadline: { label: "sisa 18 jam", urgent: false },
  reporter: { name: "Rina Netral", email: "rina@example.com", ordinal: 1 },
  createdAt: "19 Sep 2026 14.09 WIB",
  categoryLabel: "Halaman error saat mengirim jawaban",
  description: "Baris satu.\nBaris dua.",
  attempt: {
    attemptNumber: 1,
    kind: "LESSON",
    lessonPosition: 2,
    contextLine: "Kursus Netral · Materi 2 · 3 soal · 15 menit",
    scorePercent: 33,
    remaining: "09:14",
    answered: 1,
    total: 3,
  },
  timeline: [
    { time: "14.02.11", label: "Quiz dimulai · 3 soal · batas 15 menit", tone: "neutral" },
    { time: "14.03.40", label: "Jawaban soal 1 tersimpan", tone: "success" },
    { time: "14.07.19", label: "Jawaban dikumpulkan · nilai 33", tone: "neutral" },
  ],
  decision: null,
};

function responseOf(status: number, message?: string) {
  return {
    ok: status < 400,
    status,
    json: async () => (message ? { error: { code: "CONFLICT", message } } : {}),
  } as unknown as Response;
}

const submitButton = () => screen.getByRole("button", { name: /Simpan keputusan|Setujui & reset attempt|Tolak laporan/ });
const reasonBox = () => screen.getByLabelText(/Alasan untuk user/) as HTMLTextAreaElement;

describe("ResetAttemptReview", () => {
  it("left column: reporter, the story as-is, the DB-only timeline, three number boxes", () => {
    render(<ResetAttemptReview data={pending} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Laporan R-2291");
    expect(screen.getByRole("link", { name: "← Reset attempt" }).getAttribute("href")).toBe(
      "/cms/reset-attempt",
    );
    expect(screen.getByText("rina@example.com · laporan ke-1 dari akun ini")).toBeTruthy();
    expect(screen.getByText(/Baris satu\./).textContent).toBe("Baris satu.\nBaris dua.");
    expect(screen.getByText("Tenggat sisa 18 jam")).toBeTruthy();
    const timeline = screen.getByText("Catatan sistem · attempt ke-1").closest("section")!;
    expect(within(timeline).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("09:14")).toBeTruthy();
    expect(screen.getByText("1/3")).toBeTruthy();
    expect(screen.queryByText(/Lihat profil/)).toBeNull();
  });

  it("button label for the three states: none, Setujui, Tolak; checklist only for Setujui", () => {
    render(<ResetAttemptReview data={pending} />);
    expect(submitButton().textContent).toBe("Simpan keputusan");
    expect(screen.queryByText("Nilai 33 hilang dari Nilai Saya")).toBeNull();

    fireEvent.click(screen.getByLabelText(/Setujui reset/));
    expect(submitButton().textContent).toBe("Setujui & reset attempt");
    expect(screen.getByText("Nilai 33 dihapus, quiz materi 2 dibuka lagi dari awal.")).toBeTruthy();
    expect(screen.getByText("Nilai 33 hilang dari Nilai Saya")).toBeTruthy();
    expect(screen.getByText("Tercatat di audit log: admin, waktu, alasan")).toBeTruthy();

    fireEvent.click(screen.getByLabelText(/Tolak/));
    expect(submitButton().textContent).toBe("Tolak laporan");
    expect(screen.queryByText("Nilai 33 hilang dari Nilai Saya")).toBeNull();
  });

  it("kirim tanpa pilihan → group error, focus on the first radio, no fetch", async () => {
    render(<ResetAttemptReview data={pending} />);
    fireEvent.change(reasonBox(), { target: { value: REASON } });
    fireEvent.click(submitButton());
    expect(await screen.findByText("Pilih keputusan.")).toBeTruthy();
    const group = screen.getByRole("group", { name: "Keputusan" });
    expect(group.getAttribute("aria-invalid")).toBe("true");
    const errorId = group.getAttribute("aria-describedby")!;
    expect(document.getElementById(errorId)?.textContent).toBe("Pilih keputusan.");
    expect(document.activeElement).toBe(screen.getByLabelText(/Setujui reset/));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("alasan < 10 → error, no fetch", async () => {
    render(<ResetAttemptReview data={pending} />);
    fireEvent.click(screen.getByLabelText(/Tolak/));
    fireEvent.change(reasonBox(), { target: { value: "pendek" } });
    fireEvent.click(submitButton());
    expect(await screen.findByText("Alasan minimal 10 karakter.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sukses → exact POST, form reset (kembali lagi → kosong), refresh", async () => {
    fetchMock.mockResolvedValue(responseOf(200));
    render(<ResetAttemptReview data={pending} />);
    fireEvent.click(screen.getByLabelText(/Setujui reset/));
    fireEvent.change(reasonBox(), { target: { value: REASON } });
    fireEvent.click(submitButton());
    await waitFor(() => expect(mockRouter.refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/cms/reset-attempt/reports/2291/decision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "APPROVE", reason: REASON }),
    });
    await waitFor(() => expect(reasonBox().value).toBe(""));
    expect((screen.getByLabelText(/Setujui reset/) as HTMLInputElement).checked).toBe(false);
    expect(submitButton().textContent).toBe("Simpan keputusan");
  });

  it("409 → Banner with the server message", async () => {
    fetchMock.mockResolvedValue(
      responseOf(409, "Final Quiz kursus ini sudah dimulai. Reset Final Quiz dulu lewat Reset tanpa laporan, lalu putuskan laporan ini."),
    );
    render(<ResetAttemptReview data={pending} />);
    fireEvent.click(screen.getByLabelText(/Setujui reset/));
    fireEvent.change(reasonBox(), { target: { value: REASON } });
    fireEvent.click(submitButton());
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Final Quiz kursus ini sudah dimulai.",
    );
    expect(mockRouter.refresh).not.toHaveBeenCalled();
  });

  it("decided report: read-only panel, no form", () => {
    render(
      <ResetAttemptReview
        data={{
          ...pending,
          status: "REJECTED",
          deadline: null,
          decision: {
            status: "REJECTED",
            reason: "Jawaban terkirim normal.",
            internalNote: "Cek ulang besok.",
            decidedByName: "Admin Netral",
            decidedAt: "19 Sep 2026 16.40 WIB",
          },
        }}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByText("Jawaban terkirim normal.")).toBeTruthy();
    expect(screen.getByText("Cek ulang besok.")).toBeTruthy();
    expect(screen.getByText("Diputuskan oleh Admin Netral · 19 Sep 2026 16.40 WIB")).toBeTruthy();
    expect(screen.queryByText(/Tenggat/)).toBeNull();
  });
});
