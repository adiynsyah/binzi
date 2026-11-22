// @vitest-environment jsdom
import "@/components/ui/test-env";

import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The page renders next/link and StartCourseButton (useRouter) — plain
// anchors and a stub router carry the same href / aria contract (the
// my-courses.test.tsx pattern).
vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const useSessionMock = vi.fn();
vi.mock("@/components/shared/auth/auth-client", () => ({
  authClient: { useSession: (...args: unknown[]) => useSessionMock(...args) },
}));

import { CourseEnrollCta } from "./course-enroll-cta";

const PERKS = [
  "Progress tersimpan, bisa dilanjut dari HP",
  "Quiz dengan pembahasan lengkap",
  "Nilai tercatat di halaman Nilai Saya",
] as const;

// Card S6-02 §4: guest/pending → the register + login pair (Masuk returns
// to THIS page), member → StartCourseButton naming the h1; the perk list
// is the 7b copy with decorative checks.
afterEach(() => {
  vi.clearAllMocks();
});

describe("CourseEnrollCta (card S6-02)", () => {
  it("guest: primary → /daftar, secondary → /masuk?next= this page (encoded)", () => {
    useSessionMock.mockReturnValue({ data: null, isPending: false });
    render(
      <CourseEnrollCta courseId="c-1" slug="gizi-seimbang" titleId="judul" />,
    );
    expect(
      screen
        .getByRole("link", { name: "Daftar & mulai belajar" })
        .getAttribute("href"),
    ).toBe("/daftar");
    expect(
      screen
        .getByRole("link", { name: "Sudah punya akun? Masuk" })
        .getAttribute("href"),
    ).toBe("/masuk?next=%2Fkursus%2Fgizi-seimbang");
  });

  it("session still loading renders the guest pair too (first paint is session-free)", () => {
    useSessionMock.mockReturnValue({ data: null, isPending: true });
    render(
      <CourseEnrollCta courseId="c-1" slug="gizi-seimbang" titleId="judul" />,
    );
    expect(
      screen.getByRole("link", { name: "Daftar & mulai belajar" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Mulai belajar" }),
    ).toBeNull();
  });

  it("member: StartCourseButton 'Mulai belajar' names the h1 — no register link", () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: "u-1", email: "a@example.com", name: "A" } },
      isPending: false,
    });
    render(
      <CourseEnrollCta courseId="c-1" slug="gizi-seimbang" titleId="judul" />,
    );
    const button = screen.getByRole("button", { name: "Mulai belajar" });
    expect(button.getAttribute("aria-describedby")).toBe("judul");
    expect(
      screen.queryByRole("link", { name: "Daftar & mulai belajar" }),
    ).toBeNull();
  });

  it("renders the price line, the three 7b perks, and decorative checks", () => {
    useSessionMock.mockReturnValue({ data: null, isPending: false });
    render(
      <CourseEnrollCta courseId="c-1" slug="gizi-seimbang" titleId="judul" />,
    );
    expect(screen.getByText("Gratis")).toBeTruthy();
    expect(screen.getByText("Tanpa biaya, tanpa kartu kredit.")).toBeTruthy();
    for (const perk of PERKS) {
      expect(screen.getByText(perk)).toBeTruthy();
    }
    // Every check icon is aria-hidden — the perk text stands on its own.
    const icons = document.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThanOrEqual(3);
    for (const icon of icons) {
      expect(icon.getAttribute("aria-hidden")).toBe("true");
    }
  });
});
