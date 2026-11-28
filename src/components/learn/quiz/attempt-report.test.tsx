// @vitest-environment jsdom
import "../../ui/test-env";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  ReportApprovedDTO,
  ReportFormDTO,
  ReportPendingDTO,
} from "@/modules/recovery/service";

import { AttemptReport } from "./attempt-report";

// Card S3-03 §5: the five report-page states (7i / 7l) — one h1 each, the
// eyebrow, and every link with its exact href.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const COURSE = "/belajar/kursus-netral";
const QUIZ = `${COURSE}/materi-dua/quiz`;

const form: ReportFormDTO = {
  state: "form",
  eyebrow: "Quiz materi 2",
  kind: "LESSON",
  attemptId: "3f2c8f4e-8b1a-4c8e-9a51-0d6c2e7b9a10",
  quizHref: QUIZ,
  summary: {
    attemptNumber: 1,
    scope: "Materi 2",
    startedAt: "19 Sep 2026 14.02 WIB",
    stoppedAt: 2,
    total: 3,
    remaining: "09:14",
    answered: 1,
  },
};

const pending: ReportPendingDTO = {
  state: "menunggu",
  eyebrow: "Quiz materi 2",
  kind: "LESSON",
  lessonPosition: 2,
  number: 2291,
  createdAt: "19 Sep 2026 14.09 WIB",
  deadlineDate: "20 Sep 2026",
  scorePercent: 33,
  nextLesson: { position: 3, href: `${COURSE}/materi-tiga` },
  courseHref: COURSE,
};

const approved: ReportApprovedDTO = {
  state: "disetujui",
  eyebrow: "Quiz materi 2",
  kind: "LESSON",
  lessonPosition: 2,
  decisionReason: "Baris satu.\nBaris dua.",
  decidedAt: "19 Sep 2026 16.40 WIB",
  quizHref: QUIZ,
};

function h1(): string {
  const headings = screen.getAllByRole("heading", { level: 1 });
  expect(headings).toHaveLength(1);
  return headings[0]!.textContent ?? "";
}

describe("AttemptReport", () => {
  it("form: h1, eyebrow, the automatic data box, the form", () => {
    render(<AttemptReport data={form} />);
    expect(h1()).toBe("Quiz terputus di tengah jalan?");
    expect(screen.getByText("Quiz materi 2 · Laporkan gangguan")).toBeTruthy();
    expect(
      screen.getByText("Attempt ke-1 · Materi 2 · Dimulai 19 Sep 2026 14.02 WIB"),
    ).toBeTruthy();
    expect(screen.getByText("Terhenti di soal 2 dari 3 · Sisa waktu 09:14")).toBeTruthy();
    expect(screen.getByText("Jawaban tersimpan: 1 dari 3")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kirim laporan" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Batal" }).getAttribute("href")).toBe(QUIZ);
  });

  it("menunggu: pill, number, the three steps as an ordered list, next lesson link", () => {
    render(<AttemptReport data={pending} />);
    expect(h1()).toBe("Laporan Anda sedang diperiksa");
    expect(screen.getByText("Quiz materi 2 · Status laporan")).toBeTruthy();
    expect(screen.getByText("Menunggu ditinjau")).toBeTruthy();
    expect(screen.getByText("Laporan #R-2291 · 19 Sep 2026 14.09 WIB")).toBeTruthy();
    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(screen.getByText("Sedang berjalan — perkiraan selesai 20 Sep 2026")).toBeTruthy();
    expect(
      screen.getByText(
        "Nilai 33 tetap tercatat sementara dan materi lain boleh dilanjutkan. Kalau reset disetujui, nilai itu dihapus dan Anda mengulang quiz materi 2 saja.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Lanjut ke materi 3" }).getAttribute("href"),
    ).toBe(`${COURSE}/materi-tiga`);
    expect(screen.queryByText(/email/i)).toBeNull();
  });

  it("menunggu: last lesson and Final fall back to the course page", () => {
    const { unmount } = render(<AttemptReport data={{ ...pending, nextLesson: null }} />);
    expect(
      screen.getByRole("link", { name: "Ke halaman kursus" }).getAttribute("href"),
    ).toBe(COURSE);
    unmount();
    render(
      <AttemptReport
        data={{ ...pending, kind: "FINAL", lessonPosition: null, nextLesson: null, eyebrow: "Final Quiz" }}
      />,
    );
    expect(screen.getByText("Final Quiz · Status laporan")).toBeTruthy();
    expect(
      screen.getByText(
        "Nilai 33 tetap tercatat sementara. Kalau reset disetujui, nilai itu dihapus dan Anda mengulang Final Quiz.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ke halaman kursus" })).toBeTruthy();
  });

  it("disetujui: reason as-is, mono line, redo link (lesson and Final)", () => {
    const { unmount } = render(<AttemptReport data={approved} />);
    expect(h1()).toBe("Kesempatan Anda dikembalikan");
    expect(screen.getByText("Quiz materi 2 · Hasil laporan")).toBeTruthy();
    expect(screen.getByText("Reset disetujui")).toBeTruthy();
    const reason = screen.getByText(/Baris satu\./);
    expect(reason.textContent).toBe("Baris satu.\nBaris dua.");
    expect(reason.className).toContain("whitespace-pre-line");
    expect(
      screen.getByText("Ditinjau admin · 19 Sep 2026 16.40 WIB · Alasan dicatat di audit log"),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Kerjakan ulang quiz materi 2" }).getAttribute("href"),
    ).toBe(QUIZ);
    unmount();
    render(
      <AttemptReport
        data={{ ...approved, kind: "FINAL", lessonPosition: null, quizHref: `${COURSE}/final-quiz` }}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Kerjakan ulang Final Quiz" }).getAttribute("href"),
    ).toBe(`${COURSE}/final-quiz`);
  });

  it("ditolak: score h1, reason as-is, course link, no appeal box", () => {
    render(
      <AttemptReport
        data={{
          state: "ditolak",
          eyebrow: "Quiz materi 2",
          scorePercent: 33,
          decisionReason: "Jawaban terkirim normal.",
          courseHref: COURSE,
        }}
      />,
    );
    expect(h1()).toBe("Nilai 33 tetap berlaku");
    expect(screen.getByText("Reset ditolak")).toBeTruthy();
    expect(screen.getByText("Jawaban terkirim normal.")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Ke halaman kursus" }).getAttribute("href"),
    ).toBe(COURSE);
    expect(screen.queryByText(/banding/i)).toBeNull();
    expect(screen.queryByText(/Final Quiz/)).toBeNull();
  });

  it("sudah-direset: h1, explanation, course link", () => {
    render(
      <AttemptReport
        data={{ state: "sudah-direset", eyebrow: "Quiz materi 2", courseHref: COURSE }}
      />,
    );
    expect(h1()).toBe("Quiz ini sudah pernah direset");
    expect(
      screen.getByText(
        "Setiap quiz hanya bisa direset satu kali, jadi attempt ini tidak bisa dilaporkan lagi.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Ke halaman kursus" }).getAttribute("href"),
    ).toBe(COURSE);
  });
});
