// @vitest-environment jsdom
import "../ui/test-env";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";

import { LessonOutlineNav } from "./lesson-outline-nav";
import type { LessonOutlineItemDTO } from "@/modules/progress/service";

// Card S2-01 §4.B + "Selesai jika · Tes komponen": aria-current="page"
// only on the kini row, the terkunci row is plain text (no link) with an
// sr-only " (terkunci)", every other state is a link to its lesson href.
vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

function item(
  position: number,
  state: LessonOutlineItemDTO["state"],
): LessonOutlineItemDTO {
  return {
    position,
    title: `Judul materi ${position}`,
    state,
    href: state === "terkunci" ? null : `/belajar/kursus/materi-${position}`,
  };
}

const OUTLINE: LessonOutlineItemDTO[] = [
  item(1, "selesai"),
  item(2, "kini"),
  item(3, "terbuka"),
  item(4, "terkunci"),
];

describe("LessonOutlineNav", () => {
  it("renders one list item per lesson", () => {
    render(<LessonOutlineNav outline={OUTLINE} />);
    expect(screen.getByRole("list").children).toHaveLength(4);
  });

  it('marks ONLY the kini row aria-current="page"', () => {
    render(<LessonOutlineNav outline={OUTLINE} />);
    const list = screen.getByRole("list");
    const kini = within(list)
      .getAllByRole("link")
      .filter((node) => node.getAttribute("aria-current") === "page");
    expect(kini).toHaveLength(1);
    expect(kini[0]!.textContent).toContain("2 · Judul materi 2");
    expect(kini[0]!.textContent).toContain("kini");
  });

  it("terkunci is NOT a link and carries the sr-only state text", () => {
    render(<LessonOutlineNav outline={OUTLINE} />);
    const list = screen.getByRole("list");
    // Three links: selesai, kini, terbuka — the locked row is plain text.
    expect(within(list).getAllByRole("link")).toHaveLength(3);
    const lockedLabel = within(list).getByText("4 · Judul materi 4");
    expect(lockedLabel.closest("a")).toBeNull();
    expect(within(list).getByText("(terkunci)")).toBeTruthy();
  });

  it("links every non-locked state to its lesson href", () => {
    render(<LessonOutlineNav outline={OUTLINE} />);
    for (const expected of [
      "/belajar/kursus/materi-1",
      "/belajar/kursus/materi-2",
      "/belajar/kursus/materi-3",
    ]) {
      const link = screen
        .getAllByRole("link")
        .find((node) => node.getAttribute("href") === expected);
      expect(link, expected).toBeTruthy();
    }
  });
});
