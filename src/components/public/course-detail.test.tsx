// @vitest-environment jsdom
import "@/components/ui/test-env";

import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

// The CTA is deterministic in these tests: always the guest branch.
const useSessionMock = vi.fn(() => ({ data: null, isPending: false }));
vi.mock("@/components/shared/auth/auth-client", () => ({
  authClient: { useSession: () => useSessionMock() },
}));

import { CourseDetail } from "./course-detail";
import type { PublicCourseDetailDTO } from "@/modules/course/service";

function detail(
  overrides: Partial<PublicCourseDetailDTO> = {},
): PublicCourseDetailDTO {
  return {
    id: "c-1",
    slug: "gizi-seimbang",
    title: "Gizi Seimbang",
    summary: "Ringkasan.",
    levelLabel: "Pemula",
    lessonCount: 2,
    estimatedMinutes: 12,
    hasFinalQuiz: true,
    description: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Untuk siapa." }] },
      ],
    },
    lessons: [
      { position: 1, title: "Materi satu", durationSeconds: 100 },
      { position: 2, title: "Materi dua", durationSeconds: null },
    ],
    meta: { title: "Gizi Seimbang", description: "Ringkasan." },
    ...overrides,
  };
}

// Card S6-02 §4: header (breadcrumb, h1, meta row, summary, chip), the
// full outline with mono metas in lowercase DOM text, the dashed
// final-quiz note, and the RichContent description — plus the keputusan 9
// DOM order (CTA right after the header).
describe("CourseDetail (card S6-02)", () => {
  it("renders the breadcrumb back to /kursus with a ≥ 44 px touch area", () => {
    render(<CourseDetail course={detail()} />);
    const nav = screen.getByLabelText("Breadcrumb");
    expect(nav.tagName).toBe("NAV");
    const link = screen.getByRole("link", { name: "Kursus" });
    expect(link.getAttribute("href")).toBe("/kursus");
    expect(link.className).toContain("min-h-11");
  });

  it("renders the h1 (wrap-anywhere), the meta row, the summary, and the chip", () => {
    render(<CourseDetail course={detail()} />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toBe("Gizi Seimbang");
    expect(h1.id).toBe("kursus-detail-judul");
    expect(h1.className).toContain("wrap-anywhere");
    expect(screen.getByText("Pemula · 2 materi · 12 menit · Quiz per materi")).toBeTruthy();
    expect(screen.getByText("Ringkasan.")).toBeTruthy();
    expect(screen.getByText("Ditinjau ahli gizi")).toBeTruthy();
  });

  it("drops the minutes part without estimatedMinutes and the summary when null", () => {
    render(
      <CourseDetail
        course={detail({
          summary: null,
          estimatedMinutes: null,
          levelLabel: "Menengah",
        })}
      />,
    );
    expect(screen.getByText("Menengah · 2 materi · Quiz per materi")).toBeTruthy();
    expect(screen.queryByText("Ringkasan.")).toBeNull();
  });

  it("renders every outline row as plain text with the mono video/text meta", () => {
    render(<CourseDetail course={detail()} />);
    const rows = screen.getAllByRole("heading", { level: 3 });
    expect(rows.map((row) => row.textContent)).toEqual([
      "1 · Materi satu",
      "2 · Materi dua",
    ]);
    // Mono metas: DOM text lowercase (CSS uppercases) — "01:40 · video"
    // via formatPlaybackClock, "materi teks" otherwise.
    expect(screen.getByText("01:40 · video")).toBeTruthy();
    expect(screen.getByText("materi teks")).toBeTruthy();
    // Rows are NOT links — nothing is locked or previewable (keputusan 5).
    expect(screen.queryByRole("link", { name: /Materi/ })).toBeNull();
    expect(screen.queryByText(/Preview|Terkunci/i)).toBeNull();
  });

  it("tails the outline with the dashed quiz note, Final variant included", () => {
    render(<CourseDetail course={detail()} />);
    expect(
      screen.getByText("Quiz di setiap materi · Final Quiz di akhir"),
    ).toBeTruthy();

    render(<CourseDetail course={detail({ hasFinalQuiz: false })} />);
    expect(screen.getByText("Quiz di setiap materi")).toBeTruthy();
  });

  it("renders Tentang kursus ini through RichContent", () => {
    render(<CourseDetail course={detail()} />);
    expect(
      screen.getByRole("heading", { name: "Tentang kursus ini", level: 2 }),
    ).toBeTruthy();
    expect(screen.getByText("Untuk siapa.")).toBeTruthy();
  });

  it("keeps the CTA right after the header in the DOM (keputusan 9)", () => {
    render(<CourseDetail course={detail()} />);
    const cta = screen.getByText("Gratis");
    const isi = screen.getByRole("heading", { name: "Isi kursus", level: 2 });
    // Node.DOCUMENT_POSITION_FOLLOWING: isi comes AFTER cta in document
    // order — below lg the CTA sits between the header and the outline.
    expect(cta.compareDocumentPosition(isi) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
