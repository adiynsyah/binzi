// @vitest-environment jsdom
import "../ui/test-env";

import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { MyGrades } from "./my-grades";
import type {
  GradeCourseDTO,
  GradeResultDTO,
  GradesPageDTO,
} from "@/modules/attempt/service";

// MyGrades renders next/link (the empty state's button and the review
// links) — a plain anchor carries the same href / aria contract, no app
// router needed (the learn-dashboard test pattern).
vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

// Card S5-03 §4, component "Selesai jika". Pure render — the DTO is built
// by hand; the numbers' SOURCES are the integration tests' job.

function resultDto(overrides: Partial<GradeResultDTO> = {}): GradeResultDTO {
  return {
    scorePercent: 70,
    isPassed: true,
    // 2026-08-23T18:30:00Z rolls to 24 Agu 2026 in WIB — pins the date
    // column's formatter AND its timezone in one value.
    submittedAt: "2026-08-23T18:30:00.000Z",
    reviewHref: "/belajar/gizi-seimbang/materi-1/quiz",
    reviewAccess: "ALWAYS",
    ...overrides,
  };
}

function courseDto(
  id: string,
  overrides: Partial<GradeCourseDTO> = {},
): GradeCourseDTO {
  return {
    id,
    title: `Kursus ${id}`,
    lessonCount: 2,
    badge: "lulus",
    meta: { kind: "selesai", at: "2026-11-18T09:00:00.000Z" },
    finalScorePercent: 68,
    lessonAveragePercent: 60,
    lessons: [
      { position: 1, title: "Materi satu", result: resultDto() },
      {
        position: 2,
        title: "Materi dua",
        result: resultDto({
          scorePercent: 50,
          isPassed: false,
          submittedAt: "2026-09-19T02:14:00.000Z",
          reviewAccess: "HIDDEN_NOT_PASSED",
          reviewHref: "/belajar/gizi-seimbang/materi-2/quiz",
        }),
      },
    ],
    lockedCount: 0,
    final: {
      questionCount: 10,
      reviewHref: "/belajar/gizi-seimbang/final-quiz",
      result: resultDto({
        scorePercent: 80,
        reviewHref: "/belajar/gizi-seimbang/final-quiz",
      }),
    },
    nextStep: null,
    ...overrides,
  };
}

function gradesPage(
  courses: GradeCourseDTO[],
  weights = { lessonPercent: 60, finalPercent: 40 },
): GradesPageDTO {
  return { weights, courses };
}

describe("MyGrades — kosong (8f)", () => {
  it("heads with an h2 (not EmptyState's h3) and carries the 8f copy", () => {
    render(
      <MyGrades data={gradesPage([], { lessonPercent: 70, finalPercent: 30 })} />,
    );
    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Belum ada quiz yang dikerjakan",
    });
    expect(heading.tagName).toBe("H2");
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
    expect(
      screen.getByText(
        "Nilai muncul di sini setiap kali Anda menyelesaikan satu quiz materi. Nilai Akhir kursus baru dihitung setelah Final Quiz.",
      ),
    ).toBeDefined();
  });

  it("shows the formula with the props' weights (70/30), not a hardcoded split", () => {
    render(
      <MyGrades data={gradesPage([], { lessonPercent: 70, finalPercent: 30 })} />,
    );
    expect(
      screen.getByText("rata-rata quiz materi × 70% + Final Quiz × 30%", {
        exact: false,
      }),
    ).toBeDefined();
  });

  it("links Lanjutkan kursus saya to Kursus Saya as a full-width-below-640 button", () => {
    render(<MyGrades data={gradesPage([])} />);
    const link = screen.getByRole("link", { name: "Lanjutkan kursus saya" });
    expect(link.getAttribute("href")).toBe("/belajar/kursus-saya");
    expect(link.className).toContain("w-full");
    expect(link.className).toContain("sm:w-auto");
  });
});

describe("MyGrades — terisi", () => {
  it("has exactly one h1 and one h2 per course; badge text from the DTO", () => {
    render(
      <MyGrades
        data={gradesPage([
          courseDto("a"),
          courseDto("b", { badge: "sedang-berjalan" }),
        ])}
      />,
    );
    expect(
      screen.getAllByRole("heading", { level: 1, name: "Nilai Saya" }),
    ).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 2, name: "Kursus a" }));
    expect(screen.getByRole("heading", { level: 2, name: "Kursus b" }));
    expect(screen.getByText("Lulus")).toBeDefined();
    expect(screen.getByText("Sedang berjalan")).toBeDefined();
  });

  it("Nilai Akhir: text-success only for lulus; '—' when null", () => {
    render(
      <MyGrades
        data={gradesPage([
          courseDto("a"),
          courseDto("b", {
            badge: "sedang-berjalan",
            finalScorePercent: null,
          }),
        ])}
      />,
    );
    const nilaiCells = screen
      .getAllByText("68")
      .concat(screen.getAllByText("—"));
    const green = nilaiCells.find(
      (node) => node.className.includes("text-success"),
    );
    expect(green).toBeDefined();
    // The running card's "—" has no success color and no 68 of its own.
    const runningCard = screen
      .getByRole("heading", { level: 2, name: "Kursus b" })
      .closest("section")!;
    const runningNilai = within(runningCard).getAllByText("—");
    expect(runningNilai.length).toBeGreaterThan(0);
    for (const node of runningNilai) {
      expect(node.className).not.toContain("text-success");
    }
  });

  it("rows: belum, + 1 materi terkunci, Final Quiz · 10 soal", () => {
    render(
      <MyGrades
        data={gradesPage([
          courseDto("a", {
            badge: "sedang-berjalan",
            finalScorePercent: null,
            lessonAveragePercent: 70,
            lessons: [
              { position: 1, title: "Materi satu", result: resultDto() },
              { position: 2, title: "Materi dua", result: null },
            ],
            lockedCount: 1,
            final: {
              questionCount: 10,
              reviewHref: "/belajar/gizi-seimbang/final-quiz",
              result: null,
            },
            nextStep: "materi",
            meta: { kind: "terakhir-diakses", at: "2026-11-18T09:00:00.000Z" },
          }),
        ])}
      />,
    );
    // "belum" appears in BOTH the unattempted lesson row and the Final row.
    expect(screen.getAllByText("belum")).toHaveLength(2);
    expect(screen.getByText("+ 1 materi terkunci")).toBeDefined();
    expect(screen.getByText("Final Quiz · 10 soal")).toBeDefined();
    expect(screen.getByText("1 · Materi satu")).toBeDefined();
    expect(screen.getByText("2 · Materi dua")).toBeDefined();
    // The Final row alone carries the fill — the visual distinction axe
    // cannot guard (contrast only IMPROVES without it), so it is pinned
    // here (mutation 19).
    const finalRow = screen.getByRole("row", { name: /Final Quiz · 10 soal/ });
    expect(finalRow.className).toContain("bg-fill-soft");
    expect(
      screen.getByRole("row", { name: /1 · Materi satu/ }).className,
    ).not.toContain("bg-fill-soft");
  });

  it("filled intro AND card formula follow the props' weights (70/30)", () => {
    render(
      <MyGrades
        data={gradesPage([courseDto("a")], {
          lessonPercent: 70,
          finalPercent: 30,
        })}
      />,
    );
    // The intro sentence (8b)…
    expect(
      screen.getByText("× 70% + Final Quiz × 30%", { exact: false }),
    ).toBeDefined();
    // …and the card's own formula row.
    expect(
      screen.getByText(
        "Rata-rata quiz materi 60 × 70% + Final Quiz 80 × 30% = 68",
      ),
    ).toBeDefined();
  });

  it("both formula variants + the Kerjakan Final Quiz link on nextStep final", () => {
    const { rerender } = render(
      <MyGrades data={gradesPage([courseDto("a")])} />,
    );
    expect(
      screen.getByText(
        "Rata-rata quiz materi 60 × 60% + Final Quiz 80 × 40% = 68",
      ),
    ).toBeDefined();

    rerender(
      <MyGrades
        data={gradesPage([
          courseDto("a", {
            badge: "sedang-berjalan",
            finalScorePercent: null,
            nextStep: "materi",
            meta: { kind: "terakhir-diakses", at: "2026-11-18T09:00:00.000Z" },
          }),
        ])}
      />,
    );
    expect(
      screen.getByText(
        "Rata-rata quiz materi sementara 60 · Nilai Akhir belum dihitung",
      ),
    ).toBeDefined();
    expect(
      screen.getByText("Selesaikan semua materi lalu kerjakan Final Quiz."),
    ).toBeDefined();
    expect(screen.queryByText("Kerjakan Final Quiz")).toBeNull();

    rerender(
      <MyGrades
        data={gradesPage([
          courseDto("a", {
            badge: "sedang-berjalan",
            finalScorePercent: null,
            nextStep: "final",
            meta: { kind: "terakhir-diakses", at: "2026-11-18T09:00:00.000Z" },
          }),
        ])}
      />,
    );
    expect(screen.getByText("Semua materi selesai.")).toBeDefined();
    const link = screen.getByRole("link", { name: "Kerjakan Final Quiz" });
    expect(link.getAttribute("href")).toBe("/belajar/gizi-seimbang/final-quiz");
  });

  it("review links: accessible name follows reviewAccess; href from the DTO", () => {
    render(<MyGrades data={gradesPage([courseDto("a")])} />);
    expect(
      screen.getByRole("link", {
        name: "Lihat pembahasan Quiz Materi 1 · Materi satu",
      }),
    ).toBeDefined();
    expect(
      screen.getByRole("link", {
        name: "Lihat pembahasan Quiz Materi 1 · Materi satu",
      }).getAttribute("href"),
    ).toBe("/belajar/gizi-seimbang/materi-1/quiz");
    expect(
      screen.getByRole("link", {
        name: "Lihat jawaban Anda, Quiz Materi 2 · Materi dua",
      }),
    ).toBeDefined();
    expect(
      screen.getByRole("link", {
        name: "Lihat jawaban Anda, Quiz Materi 2 · Materi dua",
      }).getAttribute("href"),
    ).toBe("/belajar/gizi-seimbang/materi-2/quiz");
    expect(
      screen.getByRole("link", {
        name: "Lihat pembahasan Final Quiz · Kursus a",
      }),
    ).toBeDefined();
    expect(
      screen.getByRole("link", {
        name: "Lihat pembahasan Final Quiz · Kursus a",
      }).getAttribute("href"),
    ).toBe("/belajar/gizi-seimbang/final-quiz");
    // The visible content is "Lihat" (≥ 1024) — never the long label.
    expect(screen.getAllByText("Lihat").length).toBe(3);
  });

  it("dates render WIB-stable from the ISO strings (day roll included)", () => {
    render(<MyGrades data={gradesPage([courseDto("a")])} />);
    // Lesson 1 and the Final share resultDto()'s default stamp — two cells.
    expect(screen.getAllByText("24 Agu 2026")).toHaveLength(2);
    expect(screen.getByText("19 Sep 2026")).toBeDefined();
    expect(screen.getByText("2 materi · selesai 18 Nov 2026")).toBeDefined();
  });

  it("sr-only verdicts ride along every score (never color alone)", () => {
    render(<MyGrades data={gradesPage([courseDto("a")])} />);
    for (const node of screen.getAllByText("lulus", { exact: true })) {
      expect(node.className).toContain("sr-only");
    }
    for (const node of screen.getAllByText("belum lulus", { exact: true })) {
      expect(node.className).toContain("sr-only");
    }
  });
});
