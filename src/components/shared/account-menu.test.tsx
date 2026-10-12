// @vitest-environment jsdom
import "../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/*
 * next/navigation is mocked so the menus can be rendered against a
 * controllable pathname and router; next/link and next/image are swapped
 * for plain elements because they need a running Next runtime. The auth
 * client is stubbed so Keluar can be driven through both outcomes.
 */
let currentPathname = "/";
const replaceMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({ replace: replaceMock, refresh: refreshMock }),
}));

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

// vi.mock factories are hoisted above every const — vi.hoisted keeps the
// mock reference available to the factory.
const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn() }));

vi.mock("./auth/auth-client", () => ({
  authClient: { signOut: signOutMock },
}));

import { AccountDropdown, AccountDrawer } from "./account-menu";

const USER = { name: "Rina Kurnia", email: "rina.kurnia@email.com" };

function renderAt(pathname: string, ui: React.ReactElement) {
  currentPathname = pathname;
  return render(ui);
}

/** The pill trigger is the one carrying the member name. */
function pillTrigger(): HTMLElement {
  return screen.getByText("Rina Kurnia").closest("button") as HTMLElement;
}

async function openDropdown(pathname: string) {
  renderAt(pathname, <AccountDropdown user={USER} />);
  // Radix opens on pointerdown (mouse), not on the click event alone.
  fireEvent.pointerDown(pillTrigger(), { button: 0 });
  return screen.findByRole("menu");
}

describe("AccountDropdown", () => {
  beforeAll(() => {
    // jsdom has no matchMedia; the drawer listens for ≥640px to auto-close.
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

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("opens from the pill trigger with the 13a head and four items", async () => {
    await openDropdown("/belajar");

    expect(screen.getByText("rina.kurnia@email.com")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Dashboard" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Kursus Saya" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Nilai Saya" })).toBeTruthy();
    expect(
      screen.getByRole("menuitem", { name: "Profil & pengaturan" }),
    ).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Keluar" })).toBeTruthy();
  });

  it("keeps each trigger inside its own breakpoint", () => {
    renderAt("/belajar", <AccountDropdown user={USER} />);

    // Avatar-only 640–1023 (8t): hidden below 640 too — the drawer owns
    // that range. Token-exact so a base `grid` regression cannot hide here.
    const [avatar, pill] = screen.getAllByRole("button", {
      name: "Menu akun",
    }) as [HTMLElement, HTMLElement];
    expect(avatar.className.split(" ")).toContain("hidden");
    expect(avatar.className.split(" ")).toContain("sm:grid");
    expect(pill.className.split(" ")).toContain("hidden");
    expect(pill.className.split(" ")).toContain("lg:inline-flex");
  });

  it("marks the matching page with fill-soft + aria-current (13d rule)", async () => {
    await openDropdown("/belajar/kursus-saya");

    const active = screen.getByRole("menuitem", { name: "Kursus Saya" });
    expect(active.getAttribute("aria-current")).toBe("page");
    // Token-exact: every item carries the data-[highlighted]:bg-fill-soft
    // hover rule, only the active one the plain bg-fill-soft class.
    expect(active.className.split(" ")).toContain("bg-fill-soft");

    const idle = screen.getByRole("menuitem", { name: "Dashboard" });
    expect(idle.getAttribute("aria-current")).toBeNull();
    expect(idle.className.split(" ")).not.toContain("bg-fill-soft");
  });

  it("Keluar signs out and lands on Beranda on success", async () => {
    signOutMock.mockResolvedValueOnce({ error: null });
    await openDropdown("/belajar");

    fireEvent.click(screen.getByRole("menuitem", { name: "Keluar" }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/"));
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("Keluar failure keeps the menu open with the generic Banner", async () => {
    signOutMock.mockResolvedValueOnce({ error: { status: 500 } });
    await openDropdown("/belajar");

    fireEvent.click(screen.getByRole("menuitem", { name: "Keluar" }));

    // role="alert" is named from author, not contents — query the role and
    // assert the generic copy via textContent.
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Terjadi kesalahan. Coba lagi.");
    // The menu stayed open (card: "menu tetap terbuka").
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});

describe("AccountDrawer", () => {
  beforeAll(() => {
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

  afterEach(() => {
    vi.clearAllMocks();
  });

  function openDrawer(pathname: string) {
    renderAt(pathname, <AccountDrawer user={USER} />);
    fireEvent.click(screen.getByRole("button", { name: "Menu akun" }));
    return screen.getByRole("dialog", { name: "Menu akun" });
  }

  it("opens a full-width panel with ✕ in the avatar slot", () => {
    const dialog = openDrawer("/belajar");

    expect(dialog).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Tutup menu akun" }),
    ).toBeTruthy();
  });

  it("carries the name card, account items, main nav and Keluar", () => {
    openDrawer("/belajar");

    expect(screen.getByText("rina.kurnia@email.com")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Konsultasi di beranda" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Tentang Kami" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Cari" })).toBeTruthy();
    // Belajar is not repeated — Dashboard represents it (card).
    expect(screen.queryByRole("link", { name: "Belajar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Keluar" })).toBeTruthy();
  });

  it("marks the active account row (fill-soft + aria-current)", () => {
    openDrawer("/belajar/kursus-saya");

    const active = screen.getByRole("link", { name: "Kursus Saya" });
    expect(active.getAttribute("aria-current")).toBe("page");
    expect(active.className).toContain("bg-fill-soft");
    expect(
      screen.getByRole("link", { name: "Nilai Saya" }).getAttribute(
        "aria-current",
      ),
    ).toBeNull();
  });

  it("closes after an item is clicked and via ✕", async () => {
    openDrawer("/belajar");

    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    // Reopen, then close through the ✕ in the avatar slot.
    fireEvent.click(screen.getByRole("button", { name: "Menu akun" }));
    fireEvent.click(screen.getByRole("button", { name: "Tutup menu akun" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Keluar failure keeps the drawer open with the generic Banner", async () => {
    signOutMock.mockResolvedValueOnce({ error: { status: 500 } });
    openDrawer("/belajar");

    fireEvent.click(screen.getByRole("button", { name: "Keluar" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Terjadi kesalahan. Coba lagi.");
    expect(screen.getByRole("dialog", { name: "Menu akun" })).toBeTruthy();
  });
});
