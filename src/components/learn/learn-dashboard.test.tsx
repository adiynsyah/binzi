// @vitest-environment jsdom
import "../ui/test-env";

import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { LearnDashboard } from "./learn-dashboard";
import type {
  EnrolledCourseDTO,
  LearnerCourseDTO,
  LearnerDashboardDTO,
} from "@/modules/progress/service";

// The dashboard renders next/link and StartCourseButton (useRouter) —
// plain anchors and a stub router carry the same href / aria contract for
// these tests, no app router needed.
vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

// Card S5-01 §3, component "Selesai jika": states A/B/C/D, the
// aria-describedby wiring of every action, and the no-summary / no-minutes
// fallbacks. Pure render — the dashboard DTO is built by hand.

function availableCourse(
  id: string,
  overrides: Partial<LearnerCourseDTO> = {},
): LearnerCourseDTO {
  return {
    id,
    slug: `kursus-${id}`,
    title: `Kursus ${id}`,
    levelLabel: "Pemula",
    summary: "Ringkasan singkat",
    estimatedMinutes: 28,
    lessonCount: 6,
    startHref: `/belajar/kursus-${id}/materi-pertama`,
    ...overrides,
  };
}

function enrolledCourse(
  id: string,
  overrides: Partial<EnrolledCourseDTO> = {},
): EnrolledCourseDTO {
  return {
    id,
    slug: `kursus-${id}`,
    title: `Kursus ${id}`,
    levelLabel: "Pemula",
    lessonCount: 8,
    completedLessonCount: 4,
    badge: "sedang-berjalan",
    action: { kind: "lanjutkan", href: `/belajar/kursus-${id}/materi-4` },
    ...overrides,
  };
}

describe("LearnDashboard — state A (new participant)", () => {
  const dashboard: LearnerDashboardDTO = {
    enrolled: [],
    available: [
      availableCourse("a1"),
      availableCourse("a2"),
      availableCourse("a3"),
    ],
  };

  it("greets without 'kembali' and features available[0] only", () => {
    render(<LearnDashboard firstName="Dimas" dashboard={dashboard} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Selamat datang, Dimas" }),
    ).toBeTruthy();
    const featured = screen.getByRole("article", { name: "Kursus a1" });
    expect(
      within(featured).getByRole("button", { name: "Mulai materi 1" }),
    ).toBeTruthy();

    const lainnya = screen.getByRole("region", { name: "Kursus lainnya" });
    expect(within(lainnya).getByRole("article", { name: "Kursus a2" })).toBeTruthy();
    expect(within(lainnya).getByRole("article", { name: "Kursus a3" })).toBeTruthy();
    // Card §3.D: the featured course never repeats in "Kursus lainnya".
    expect(
      within(lainnya).queryByRole("article", { name: "Kursus a1" }),
    ).toBeNull();
  });

  it("renders the 28a copy blocks: intro, eyebrow, Cara belajar, empty scores", () => {
    render(<LearnDashboard firstName="Dimas" dashboard={dashboard} />);

    expect(screen.getByText(/Belum ada kursus yang Anda ikuti/)).toBeTruthy();
    expect(screen.getAllByText("MULAI DARI SINI").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Cara belajar di BINZI" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Nilai Saya masih kosong" }),
    ).toBeTruthy();
  });

  it("shows only '{n} MATERI' when estimatedMinutes is null, and level alone without a summary", () => {
    render(
      <LearnDashboard
        firstName="Dimas"
        dashboard={{
          enrolled: [],
          available: [
            availableCourse("solo", {
              summary: null,
              estimatedMinutes: null,
              lessonCount: 6,
            }),
          ],
        }}
      />,
    );
    // Featured meta omits the minutes segment entirely.
    expect(screen.getByText("6 MATERI")).toBeTruthy();
    expect(screen.queryByText(/MENIT/)).toBeNull();
    // Summary row degrades to the level label alone.
    expect(screen.getByText("Pemula")).toBeTruthy();
    expect(screen.queryByText(/Pemula ·/)).toBeNull();
    // Single course → no "Kursus lainnya" section at all.
    expect(screen.queryByRole("region", { name: "Kursus lainnya" })).toBeNull();
  });
});

describe("LearnDashboard — state B (returning participant)", () => {
  const dashboard: LearnerDashboardDTO = {
    enrolled: [
      enrolledCourse("b1"),
      enrolledCourse("b2", {
        badge: "belum-dimulai",
        completedLessonCount: 0,
        action: { kind: "mulai", href: "/belajar/kursus-b2/materi-pertama" },
      }),
    ],
    available: [availableCourse("a1")],
  };

  it("greets with 'kembali' and lists 'Kursus saya' rows", () => {
    render(<LearnDashboard firstName="Rina" dashboard={dashboard} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Selamat datang kembali, Rina",
      }),
    ).toBeTruthy();
    const section = screen.getByRole("region", { name: "Kursus saya" });
    const row1 = within(section).getByRole("article", { name: "Kursus b1" });
    const row2 = within(section).getByRole("article", { name: "Kursus b2" });

    expect(within(row1).getByText("Sedang berjalan")).toBeTruthy();
    expect(within(row1).getByText("4/8 MATERI")).toBeTruthy();
    const lanjutkan = within(row1).getByRole("link", { name: "Lanjutkan" });
    expect(lanjutkan.getAttribute("href")).toBe("/belajar/kursus-b1/materi-4");

    expect(within(row2).getByText("Belum dimulai")).toBeTruthy();
    expect(within(row2).getByText("0/8 MATERI")).toBeTruthy();
    const mulai = within(row2).getByRole("link", { name: "Mulai materi 1" });
    expect(mulai.getAttribute("href")).toBe("/belajar/kursus-b2/materi-pertama");
  });

  it("state D: an enrolled course never appears in 'Kursus lainnya'", () => {
    render(<LearnDashboard firstName="Rina" dashboard={dashboard} />);
    const lainnya = screen.getByRole("region", { name: "Kursus lainnya" });
    expect(within(lainnya).getByRole("article", { name: "Kursus a1" })).toBeTruthy();
    expect(
      within(lainnya).queryByRole("article", { name: "Kursus b1" }),
    ).toBeNull();
  });
});

describe("LearnDashboard — state C (nothing yet)", () => {
  it("shows the EmptyState with both ways out", () => {
    render(
      <LearnDashboard firstName="" dashboard={{ enrolled: [], available: [] }} />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Selamat datang" }),
    ).toBeTruthy();
    expect(screen.getByText("KURSUS · BELUM ADA")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Belum ada kursus yang terbit" }),
    ).toBeTruthy();
    expect(
      screen.getByText("Kursus pertama sedang disiapkan ahli gizi."),
    ).toBeTruthy();
    const tanya = screen.getByRole("link", { name: "Tanya Ahli Gizi" });
    expect(tanya.getAttribute("href")).toBe("/#tanya-ahli-gizi");
    const beranda = screen.getByRole("link", { name: "Kembali ke Beranda" });
    expect(beranda.getAttribute("href")).toBe("/");
  });
});

describe("aria-describedby wiring", () => {
  it("every action points at the title id of its own article", () => {
    render(
      <LearnDashboard
        firstName="Rina"
        dashboard={{
          enrolled: [enrolledCourse("b1")],
          available: [availableCourse("a1"), availableCourse("a2")],
        }}
      />,
    );

    const featured = screen.getByRole("article", { name: "Kursus a1" });
    const featuredTitle = within(featured).getByRole("heading", {
      name: "Kursus a1",
    });
    const featuredButton = within(featured).getByRole("button", {
      name: "Mulai materi 1",
    });
    expect(featuredButton.getAttribute("aria-describedby")).toBe(
      featuredTitle.id,
    );

    const lainnya = screen.getByRole("region", { name: "Kursus lainnya" });
    const otherRow = within(lainnya).getByRole("article", { name: "Kursus a2" });
    const otherTitle = within(otherRow).getByRole("heading", {
      name: "Kursus a2",
    });
    const otherButton = within(otherRow).getByRole("button", {
      name: "Mulai materi 1",
    });
    expect(otherButton.getAttribute("aria-describedby")).toBe(otherTitle.id);

    const mine = screen.getByRole("region", { name: "Kursus saya" });
    const myRow = within(mine).getByRole("article", { name: "Kursus b1" });
    const myTitle = within(myRow).getByRole("heading", { name: "Kursus b1" });
    const myLink = within(myRow).getByRole("link", { name: "Lanjutkan" });
    expect(myLink.getAttribute("aria-describedby")).toBe(myTitle.id);
  });
});
