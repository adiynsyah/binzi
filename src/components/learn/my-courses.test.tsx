// @vitest-environment jsdom
import "../ui/test-env";

import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { MyCourses } from "./my-courses";
import type {
  LearnerCourseDTO,
  MyCourseDTO,
  MyCoursesPageDTO,
} from "@/modules/progress/service";

// The page renders next/link and StartCourseButton (useRouter) — plain
// anchors and a stub router carry the same href / aria contract, no app
// router needed (learn-dashboard.test.tsx pattern).
vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

// Card S5-04 §3, component "Selesai jika": the three badge shapes (13b),
// the per-badge meta/sub/action rows, the aria-describedby wiring, the
// progress tone split, and both 13c empties. Pure render — the DTO is
// built by hand; the serializer's null-field rules are tested there.

// Fixed instants rendered as the SAME WIB calendar day (00:00 UTC = 07:00 WIB).
const AT_RUNNING = "2026-11-18T00:00:00.000Z"; // 18 Nov 2026
const AT_DONE = "2026-08-28T00:00:00.000Z"; // 28 Agu 2026
const AT_ENROLLED = "2026-09-12T00:00:00.000Z"; // 12 Sep 2026

function myCourse(
  id: string,
  overrides: Partial<MyCourseDTO> = {},
): MyCourseDTO {
  return {
    id,
    slug: `kursus-${id}`,
    title: `Kursus ${id}`,
    badge: "sedang-berjalan",
    lessonCount: 8,
    completedLessonCount: 2,
    meta: { kind: "terakhir-dibuka", at: AT_RUNNING },
    finalScorePercent: null,
    lastLessonTitle: null,
    estimatedMinutes: null,
    continueHref: `/belajar/kursus-${id}/materi-5`,
    progressHref: `/belajar/kursus-${id}`,
    ...overrides,
  };
}

function availableCourse(
  id: string,
  overrides: Partial<LearnerCourseDTO> = {},
): LearnerCourseDTO {
  return {
    id,
    slug: `kursus-${id}`,
    title: `Kursus ${id}`,
    levelLabel: "Pemula",
    summary: null,
    estimatedMinutes: 42,
    lessonCount: 8,
    startHref: `/belajar/kursus-${id}/materi-pertama`,
    ...overrides,
  };
}

describe("MyCourses — terisi (13b)", () => {
  const running = myCourse("a1", {
    title: "Gizi Seimbang",
    lastLessonTitle: "Camilan aman & porsinya",
  });
  const passed = myCourse("a2", {
    title: "Membaca Label Gizi",
    badge: "lulus",
    lessonCount: 6,
    completedLessonCount: 6,
    meta: { kind: "selesai", at: AT_DONE },
    finalScorePercent: 90,
  });
  const untouched = myCourse("a3", {
    title: "Menyusun Menu Keluarga",
    badge: "belum-dimulai",
    lessonCount: 7,
    completedLessonCount: 0,
    meta: { kind: "diikuti", at: AT_ENROLLED },
    estimatedMinutes: 38,
    continueHref: "/belajar/kursus-a3/materi-pertama",
  });
  const data: MyCoursesPageDTO = {
    courses: [running, passed, untouched],
    available: [],
  };

  it("renders one head + one card per course with the count intro", () => {
    render(<MyCourses data={data} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Kursus Saya" }),
    ).toBeTruthy();
    expect(screen.getByText("Belajar / Kursus Saya")).toBeTruthy();
    expect(
      screen.getByText(
        "3 kursus yang Anda ikuti. Progress tersimpan otomatis — boleh dilanjut kapan saja.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Jelajahi kursus lain" }).getAttribute(
        "href",
      ),
    ).toBe("/kursus");
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

  it("meta + sub rows follow the badge", () => {
    render(<MyCourses data={data} />);

    expect(
      screen.getByText("2/8 materi · terakhir dibuka 18 Nov 2026"),
    ).toBeTruthy();
    expect(
      screen.getByText("Terakhir dibuka: Camilan aman & porsinya"),
    ).toBeTruthy();

    expect(
      screen.getByText("6/6 materi · selesai 28 Agu 2026 · Nilai Akhir 90"),
    ).toBeTruthy();
    // selesai/lulus has NO row under the title (scoped to that article).
    const articles = screen.getAllByRole("article");
    expect(
      within(articles[1]!).queryByText(/Terakhir dibuka|Belum ada materi/),
    ).toBeNull();

    expect(
      screen.getByText("0/7 materi · diikuti 12 Sep 2026"),
    ).toBeTruthy();
    expect(
      screen.getByText("Belum ada materi yang dibuka · 38 menit total"),
    ).toBeTruthy();
  });

  it("actions follow the badge; every control names its course (aria-describedby → h2)", () => {
    render(<MyCourses data={data} />);

    const lanjutkan = screen.getByRole("link", { name: "Lanjutkan" });
    expect(lanjutkan.getAttribute("href")).toBe("/belajar/kursus-a1/materi-5");
    expect(lanjutkan.getAttribute("aria-describedby")).toBe("kursus-saya-a1");
    expect(
      screen
        .getByRole("heading", { level: 2, name: "Gizi Seimbang" })
        .getAttribute("id"),
    ).toBe("kursus-saya-a1");

    const progressLinks = screen.getAllByRole("link", {
      name: "Lihat progress",
    });
    expect(progressLinks).toHaveLength(2);
    expect(progressLinks[0]!.getAttribute("href")).toBe("/belajar/kursus-a1");
    expect(progressLinks[0]!.getAttribute("aria-describedby")).toBe(
      "kursus-saya-a1",
    );

    expect(
      screen.getByRole("link", { name: "Lihat nilai" }).getAttribute("href"),
    ).toBe("/belajar/nilai");
    expect(
      screen.getByRole("link", { name: "Mulai materi 1" }).getAttribute(
        "href",
      ),
    ).toBe("/belajar/kursus-a3/materi-pertama");
  });

  it("progress tone: success only for selesai/lulus, primary otherwise", () => {
    render(<MyCourses data={data} />);

    const articles = screen.getAllByRole("article");
    // The progressbar's fill (NOT the aria-hidden CoverBlock).
    const fillOf = (index: number) =>
      articles[index]!.querySelector('[role="progressbar"] [aria-hidden]')!
        .className;
    expect(fillOf(0)).toContain("bg-primary");
    expect(fillOf(1)).toContain("bg-success");
    expect(fillOf(2)).toContain("bg-primary");
  });
});

describe("MyCourses — kosong (13c)", () => {
  it("with available courses: the count sentence, the rows, and their start buttons", () => {
    const data: MyCoursesPageDTO = {
      courses: [],
      available: [availableCourse("b1"), availableCourse("b2")],
    };
    render(<MyCourses data={data} />);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Anda belum mengikuti kursus apa pun",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText("2 kursus tersedia dan semuanya gratis."),
    ).toBeTruthy();
    expect(screen.getAllByText("8 materi · 42 menit")).toHaveLength(2);

    const starts = screen.getAllByRole("button", { name: "Mulai materi 1" });
    expect(starts).toHaveLength(2);
    expect(starts[0]!.getAttribute("aria-describedby")).toBe(
      "kursus-tersedia-b1",
    );
    expect(
      screen.getByRole("link", { name: "Jelajahi semua kursus" }).getAttribute(
        "href",
      ),
    ).toBe("/kursus");
    expect(
      screen.queryByRole("link", { name: "Jelajahi kursus lain" }),
    ).toBeNull();
  });

  it("nothing available either: the other sentence, no start buttons", () => {
    render(<MyCourses data={{ courses: [], available: [] }} />);

    expect(
      screen.getByText("Belum ada kursus yang bisa diikuti saat ini."),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Mulai materi 1" }),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "Jelajahi semua kursus" }).getAttribute(
        "href",
      ),
    ).toBe("/kursus");
  });
});
