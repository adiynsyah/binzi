// @vitest-environment jsdom
import "../ui/test-env";

import { cleanup, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { CourseProgress } from "./course-progress";
import type {
  CourseProgressLessonDTO,
  CourseProgressPageDTO,
} from "@/modules/progress/service";
import type { ScoreWeights } from "@/modules/quiz/service";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

// Card S5-04 §4, component "Selesai jika": the five status rows (8c table),
// the Final row's three states, and the ringkasan — with the weights
// arriving as PROPS and tested 70/30 in every state that renders them
// (owner review addition 6). Pure render; the status itself is decided in
// the serializer (policy tests).

const WEIGHTS_70_30: ScoreWeights = { lessonPercent: 70, finalPercent: 30 };
const AT_ACTIVITY = "2026-11-18T00:00:00.000Z"; // 18 Nov 2026 (07:00 WIB)

function lessonDto(
  position: number,
  overrides: Partial<CourseProgressLessonDTO> = {},
): CourseProgressLessonDTO {
  return {
    position,
    title: `Materi ${position}`,
    status: "belum-mulai",
    href: `/belajar/kursus-x/materi-${position}`,
    hasVideo: false,
    scorePercent: null,
    isPassed: null,
    video: null,
    ...overrides,
  };
}

function progresDto(
  overrides: Partial<
    Extract<CourseProgressPageDTO, { state: "progres" }>
  > = {},
): Extract<CourseProgressPageDTO, { state: "progres" }> {
  return {
    state: "progres",
    course: { id: "course-1", title: "Gizi Seimbang" },
    badge: "sedang-berjalan",
    lessonCount: 8,
    completedLessonCount: 4,
    lastActivityAt: AT_ACTIVITY,
    lessons: [],
    final: {
      status: "terkunci",
      href: "/belajar/kursus-x/final-quiz",
      questionCount: 10,
      durationMinutes: 20,
    },
    lessonAveragePercent: 84,
    gradedLessonCount: 4,
    hasFailedLesson: false,
    finalScorePercent: null,
    ...overrides,
  };
}

describe("CourseProgress — kepala (8c)", () => {
  it("eyebrow, h1 course title, and the rounded percent line", () => {
    render(
      <CourseProgress progres={progresDto()} weights={WEIGHTS_70_30} />,
    );

    expect(screen.getByText("Belajar / Kursus Saya")).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 1, name: "Gizi Seimbang" }),
    ).toBeTruthy();
    // 4/8 → exactly 50%; DOM text lowercase, uppercase is CSS.
    expect(screen.getByText("50% · 4/8 materi")).toBeTruthy();
  });

  it("progress tone follows the course status: primary running, success done", () => {
    const { container } = render(
      <CourseProgress progres={progresDto()} weights={WEIGHTS_70_30} />,
    );
    const fill = container.querySelector(
      '[role="progressbar"] [aria-hidden]',
    )!;
    expect(fill.className).toContain("bg-primary");

    cleanup();
    const { container: doneContainer } = render(
      <CourseProgress
        progres={progresDto({ badge: "lulus" })}
        weights={WEIGHTS_70_30}
      />,
    );
    const done = doneContainer.querySelector(
      '[role="progressbar"] [aria-hidden]',
    )!;
    expect(done.className).toContain("bg-success");
  });
});

describe("CourseProgress — baris materi (lima status)", () => {
  function setup() {
    render(
      <CourseProgress
        progres={progresDto({
          lessons: [
            lessonDto(1, {
              status: "selesai",
              hasVideo: true,
              scorePercent: 90,
              isPassed: true,
            }),
            lessonDto(2, {
              status: "selesai",
              scorePercent: 67,
              isPassed: false,
            }),
            lessonDto(3, {
              status: "quiz-belum",
              hasVideo: true,
            }),
            lessonDto(4, { status: "quiz-belum" }),
            lessonDto(5, {
              status: "sedang-dipelajari",
              video: { positionSeconds: 40, durationSeconds: 100 },
            }),
            lessonDto(6),
            lessonDto(7, { status: "terkunci", href: null }),
          ],
        })}
        weights={WEIGHTS_70_30}
      />,
    );
  }

  it("one status line per row, exactly the 8c copy", () => {
    setup();

    expect(screen.getByText("Selesai · Nilai 90")).toBeTruthy();
    expect(screen.getByText("Selesai · Nilai 67 · Belum lulus")).toBeTruthy();
    expect(screen.getByText("Video selesai · Quiz belum dikerjakan"))
      .toBeTruthy();
    expect(screen.getByText("Quiz belum dikerjakan")).toBeTruthy();
    expect(screen.getByText("Sedang dipelajari · 00:40 / 01:40"))
      .toBeTruthy();
    expect(screen.getByText("Belum mulai")).toBeTruthy();
    expect(screen.getByText("Terkunci")).toBeTruthy();
  });

  it("titles link to the lesson page unless terkunci; actions follow the table", () => {
    setup();

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(7);

    // selesai: text action, video vs no video.
    expect(
      within(rows[0]!).getByRole("link", { name: "Tonton ulang" }).getAttribute(
        "href",
      ),
    ).toBe("/belajar/kursus-x/materi-1");
    expect(
      within(rows[1]!).getByRole("link", { name: "Buka materi" }).getAttribute(
        "href",
      ),
    ).toBe("/belajar/kursus-x/materi-2");

    // quiz-belum: dark button to the LESSON page (decision 5 — the S3-01
    // confirm dialog must stay in the path), named after its row.
    const kerjakan = within(rows[2]!).getByRole("link", {
      name: "Kerjakan quiz",
    });
    expect(kerjakan.getAttribute("href")).toBe("/belajar/kursus-x/materi-3");
    expect(kerjakan.getAttribute("aria-describedby")).toBe("progres-materi-3");

    // sedang-dipelajari: Lanjutkan.
    expect(
      within(rows[4]!).getByRole("link", { name: "Lanjutkan" }).getAttribute(
        "href",
      ),
    ).toBe("/belajar/kursus-x/materi-5");

    // belum-mulai: the title is still a link, no action.
    expect(
      within(rows[5]!).getByRole("link", { name: "6 · Materi 6" }),
    ).toBeTruthy();
    expect(within(rows[5]!).queryByRole("link")).toBeTruthy();

    // terkunci: NO link at all in the row — the title is plain text.
    expect(within(rows[6]!).queryByRole("link")).toBeNull();
    expect(within(rows[6]!).getByText("7 · Materi 7")).toBeTruthy();
  });
});

describe("CourseProgress — baris Final Quiz", () => {
  it("terkunci names the remaining lessons and the weight FROM PROPS (70/30)", () => {
    render(
      <CourseProgress progres={progresDto()} weights={WEIGHTS_70_30} />,
    );

    expect(screen.getByText("Final Quiz · 10 soal")).toBeTruthy();
    expect(
      screen.getByText(
        "Terbuka setelah 8 materi selesai · 20 menit · bobot 30%",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Kerjakan Final Quiz" }))
      .toBeNull();
  });

  it("terbuka shows the weight from props and the dark CTA", () => {
    render(
      <CourseProgress
        progres={progresDto({
          final: {
            status: "terbuka",
            href: "/belajar/kursus-x/final-quiz",
            questionCount: 10,
            durationMinutes: 20,
          },
        })}
        weights={WEIGHTS_70_30}
      />,
    );

    expect(screen.getByText("Terbuka · 20 menit · bobot 30%")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Kerjakan Final Quiz" }).getAttribute(
        "href",
      ),
    ).toBe("/belajar/kursus-x/final-quiz");
  });

  it("selesai: Sudah dikerjakan + Lihat hasil", () => {
    render(
      <CourseProgress
        progres={progresDto({
          final: {
            status: "selesai",
            href: "/belajar/kursus-x/final-quiz",
            questionCount: 10,
            durationMinutes: 20,
          },
        })}
        weights={WEIGHTS_70_30}
      />,
    );

    expect(screen.getByText("Sudah dikerjakan")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Lihat hasil" }).getAttribute("href"),
    ).toBe("/belajar/kursus-x/final-quiz");
  });
});

describe("CourseProgress — ringkasan (8c kanan)", () => {
  it("IN_PROGRESS: the raw average, the graded count, and the formula with PROPS weights", () => {
    render(
      <CourseProgress progres={progresDto()} weights={WEIGHTS_70_30} />,
    );

    expect(screen.getByText("Ringkasan nilai")).toBeTruthy();
    expect(screen.getByText("84")).toBeTruthy();
    expect(screen.getByText("rata-rata 4 quiz materi")).toBeTruthy();
    expect(
      screen.getByText("Nilai Akhir = 84 × 70% + Final Quiz × 30%."),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Lihat di Nilai Saya" }).getAttribute(
        "href",
      ),
    ).toBe("/belajar/nilai");
  });

  it("hasFailedLesson adds the permanence note without numbers", () => {
    render(
      <CourseProgress
        progres={progresDto({ hasFailedLesson: true })}
        weights={WEIGHTS_70_30}
      />,
    );

    expect(
      screen.getByText(
        "Nilai di bawah batas lulus tidak mengunci apa pun — materi tetap tercatat selesai dan Anda boleh lanjut. Nilai itu permanen karena quiz hanya sekali.",
      ),
    ).toBeTruthy();
  });

  it("selesai/lulus replaces the formula with the stored verdict", () => {
    render(
      <CourseProgress
        progres={progresDto({
          badge: "lulus",
          finalScorePercent: 90,
        })}
        weights={WEIGHTS_70_30}
      />,
    );

    expect(screen.getByText("Nilai Akhir 90 · Lulus")).toBeTruthy();
    expect(screen.queryByText(/Nilai Akhir = /)).toBeNull();
  });

  it("null average renders — and Terakhir diakses uses formatWibDate", () => {
    render(
      <CourseProgress
        progres={progresDto({
          lessonAveragePercent: null,
          gradedLessonCount: 0,
        })}
        weights={WEIGHTS_70_30}
      />,
    );

    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("rata-rata 0 quiz materi")).toBeTruthy();
    expect(screen.getByText("Terakhir diakses 18 Nov 2026")).toBeTruthy();
  });
});
