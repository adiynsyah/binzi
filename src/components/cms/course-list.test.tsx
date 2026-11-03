// @vitest-environment jsdom
import "../ui/test-env";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CourseList } from "./course-list";
import type {
  CmsCourseListItemDTO,
  CourseStatusCounts,
} from "@/modules/course/serializer";

// Card S1-01 (screen 21e): tabs, in-tab search, TOTAL tab badges, and the
// completeness columns. Counts are plain data here — the server side is
// covered by service.integration.test.ts.
//
// CourseList renders CreateCourseDialog, whose useRouter needs the app
// router context — stubbed the same way as create-course-dialog.test.tsx.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

const baseItem = {
  level: "BEGINNER" as const,
  lessonCount: 8,
  finalQuizQuestionCount: 20,
  ownerName: "Pundra R.",
  updatedAt: "2026-11-03T08:00:00.000Z",
};

function item(overrides: Partial<CmsCourseListItemDTO>): CmsCourseListItemDTO {
  return { ...baseItem, enrollmentCount: 0, ...overrides } as CmsCourseListItemDTO;
}

const courses: CmsCourseListItemDTO[] = [
  item({
    id: "c1",
    title: "Gizi Seimbang untuk Ibu Hamil Trimester Pertama",
    slug: "gizi-1",
    status: "PUBLISHED",
    enrollmentCount: 1284,
  }),
  item({
    id: "c2",
    title: "Membaca Label Gizi Kemasan",
    slug: "label-1",
    status: "PUBLISHED",
  }),
  item({
    id: "c3",
    title: "Menu Keluarga Sepekan",
    slug: "menu-1",
    status: "IN_REVIEW",
    level: "INTERMEDIATE",
  }),
  item({
    id: "c4",
    title: "Gizi Seimbang Trimester Kedua",
    slug: "gizi-2",
    status: "DRAFT",
  }),
];

const counts: CourseStatusCounts = {
  total: 4,
  DRAFT: 1,
  IN_REVIEW: 1,
  PUBLISHED: 2,
  ARCHIVED: 0,
};

describe("CourseList", () => {
  it("renders the heading, the per-status summary, and one row per course", () => {
    render(<CourseList courses={courses} counts={counts} />);

    expect(screen.getByRole("heading", { name: "Kursus" })).toBeTruthy();
    expect(
      screen.getByText("2 terbit · 1 menunggu persetujuan · 1 draf"),
    ).toBeTruthy();

    const row = screen.getByText("Menu Keluarga Sepekan").closest("tr");
    expect(row).toBeTruthy();
    expect(within(row as HTMLElement).getByText("Menengah · Pundra R.")).toBeTruthy();
    expect(within(row as HTMLElement).getByText("8 materi")).toBeTruthy();
    expect(within(row as HTMLElement).getByText("20 / 20 soal")).toBeTruthy();
    expect(within(row as HTMLElement).getByText("Menunggu persetujuan")).toBeTruthy();
    expect(within(row as HTMLElement).getByText("—")).toBeTruthy();
  });

  it("formats the participant count for the id-ID locale", () => {
    render(<CourseList courses={courses} counts={counts} />);
    expect(screen.getByText("1.284")).toBeTruthy();
  });

  it("links each row into the builder", () => {
    render(<CourseList courses={courses} counts={counts} />);
    expect(screen.getAllByRole("link", { name: "Buka" })).toHaveLength(4);
    expect(
      screen
        .getAllByRole("link", { name: "Buka" })
        .every((link) => /^\/cms\/kursus\/c\d$/.test(link.getAttribute("href") ?? "")),
    ).toBe(true);
  });

  it("keeps tab badges at TOTAL counts while the table shows the active tab only", () => {
    render(<CourseList courses={courses} counts={counts} />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Terbit/ }));

    expect(screen.queryByText("Menu Keluarga Sepekan")).toBeNull();
    expect(screen.getByText("Membaca Label Gizi Kemasan")).toBeTruthy();
    // Badges still report totals (2 terbit · 1 menunggu · 1 draf · 0 arsip).
    expect(screen.getByRole("tab", { name: /Semua/ }).textContent).toContain("4");
    expect(screen.getByRole("tab", { name: /Draf/ }).textContent).toContain("1");
  });

  it("searches within the active tab, not across all statuses", () => {
    render(<CourseList courses={courses} counts={counts} />);
    fireEvent.change(screen.getByLabelText("Cari kursus"), {
      target: { value: "Gizi Seimbang" },
    });

    // "Semua" tab: two gizi courses…
    expect(screen.getByText("Gizi Seimbang untuk Ibu Hamil Trimester Pertama")).toBeTruthy();
    expect(screen.getByText("Gizi Seimbang Trimester Kedua")).toBeTruthy();

    // …but inside the "Draf" tab the same query finds only the draft one.
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Draf/ }));
    expect(screen.queryByText("Gizi Seimbang untuk Ibu Hamil Trimester Pertama")).toBeNull();
    expect(screen.getByText("Gizi Seimbang Trimester Kedua")).toBeTruthy();
  });

  it("shows the not-found empty state when a filter matches nothing", () => {
    render(<CourseList courses={courses} counts={counts} />);
    fireEvent.change(screen.getByLabelText("Cari kursus"), {
      target: { value: "tidak-ada" },
    });

    expect(screen.getByText("Tidak ada kursus yang cocok.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hapus pencarian" }));
    expect(screen.getByText("Gizi Seimbang Trimester Kedua")).toBeTruthy();
  });

  it("shows the empty state and opens the dialog when there are no courses", () => {
    render(
      <CourseList
        courses={[]}
        counts={{ total: 0, DRAFT: 0, IN_REVIEW: 0, PUBLISHED: 0, ARCHIVED: 0 }}
      />,
    );

    expect(screen.getByText("Belum ada kursus.")).toBeTruthy();
    // The header button and the empty state both offer the dialog.
    const buttons = screen.getAllByRole("button", { name: "+ Kursus baru" });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1] as HTMLElement);
    expect(screen.getByText("Mulai kursus baru")).toBeTruthy();
  });
});
