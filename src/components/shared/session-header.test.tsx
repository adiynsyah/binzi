// @vitest-environment jsdom
import "../ui/test-env";

import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

/*
 * The auth client is stubbed at the module boundary so useSession can be
 * driven through its three states: loading, guest (no session), member.
 * next/link and next/image are plain elements (they need a Next runtime).
 */
vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    ...props
  }: ComponentProps<"img"> & { priority?: boolean; src?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element -- plain test double
    <img src={typeof src === "string" ? src : ""} alt={alt} {...props} />
  ),
}));

const useSessionMock = vi.fn();

vi.mock("./auth/auth-client", () => ({
  authClient: { useSession: (...args: unknown[]) => useSessionMock(...args) },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import { SessionHeader } from "./session-header";

describe("SessionHeader", () => {
  beforeAll(() => {
    // jsdom has no matchMedia; the account drawer listens for ≥640px.
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      })),
    );
  });

  it("renders the guest header while the session is loading (no skeleton)", () => {
    useSessionMock.mockReturnValue({ data: undefined, isPending: true });

    render(<SessionHeader />);

    // "Masuk" renders twice in the guest header (its 640–1023 and ≥1024
    // variants both live in the DOM, revealed per breakpoint).
    expect(screen.getAllByText("Masuk").length).toBeGreaterThan(0);
    expect(screen.getByText("Daftar Gratis")).toBeTruthy();
    expect(screen.queryByText("Rina Kurnia")).toBeNull();
  });

  it("renders the guest header for guests (no session)", () => {
    useSessionMock.mockReturnValue({ data: null, isPending: false });

    render(<SessionHeader />);

    expect(screen.getAllByText("Masuk").length).toBeGreaterThan(0);
    expect(screen.getByText("Daftar Gratis")).toBeTruthy();
  });

  it("swaps to the member header once the session resolves", () => {
    useSessionMock.mockReturnValue({
      data: {
        user: { name: "Rina Kurnia", email: "rina.kurnia@email.com" },
      },
      isPending: false,
    });

    render(<SessionHeader />);

    expect(screen.queryByText("Daftar Gratis")).toBeNull();
    expect(screen.getByText("Rina Kurnia")).toBeTruthy(); // the pill
    expect(screen.getByRole("link", { name: "Belajar" })).toBeTruthy();
  });
});
