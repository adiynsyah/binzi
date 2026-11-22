// @vitest-environment jsdom
import "../../ui/test-env";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AccountSecurityDTO } from "@/modules/user/service";

import { ProfileSettings } from "./profile-settings";

// Card S5-05: the server shell — eyebrow + ONE h1, both section headings,
// the identity row (member since + decorative avatar → no <img>, initials
// only), and which Keamanan rows the AccountSecurityDTO switches on/off
// (password form vs /lupa-password link, Google row, device count).

vi.mock("@/components/shared/auth/auth-client", () => ({
  authClient: { changePassword: vi.fn(), revokeSessions: vi.fn(), signOut: vi.fn() },
}));

const mockRouter = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

const PROFILE = {
  name: "Rina Tester",
  email: "rina@example.com",
  emailVerified: true,
  memberSince: "24 Agu 2026",
};

const SECURITY: AccountSecurityDTO = {
  hasPassword: true,
  googleLinked: true,
  activeSessionCount: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProfileSettings", () => {
  it("renders the eyebrow and exactly one h1", () => {
    render(<ProfileSettings profile={PROFILE} security={SECURITY} />);
    expect(screen.getByText("Belajar / Profil")).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 1, name: "Profil & pengaturan" }),
    ).toBeTruthy();
    // h1 + 2× h2 + 3× h3 (Password, Google, Sesi aktif).
    expect(screen.getAllByRole("heading")).toHaveLength(6);
  });

  it("shows the identity row: member since, initials avatar (no <img>)", () => {
    const { container } = render(
      <ProfileSettings profile={PROFILE} security={SECURITY} />,
    );
    expect(screen.getByText("Rina Tester")).toBeTruthy();
    expect(screen.getByText("Anggota sejak 24 Agu 2026")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });

  it("marks the section headings and wires them with aria-labelledby", () => {
    render(<ProfileSettings profile={PROFILE} security={SECURITY} />);
    const data = screen.getByRole("heading", { name: "Data akun" });
    const keamanan = screen.getByRole("heading", { name: "Keamanan" });
    expect(data.id).toBe("profil-data-heading");
    expect(keamanan.id).toBe("profil-keamanan-heading");
    expect(
      document.querySelector('section[aria-labelledby="profil-data-heading"]'),
    ).not.toBeNull();
    expect(
      document.querySelector(
        'section[aria-labelledby="profil-keamanan-heading"]',
      ),
    ).not.toBeNull();
  });

  it("email stays a read-only display field carrying the value", () => {
    render(<ProfileSettings profile={PROFILE} security={SECURITY} />);
    const input = screen.getByLabelText("Email") as HTMLInputElement;
    expect(input.value).toBe("rina@example.com");
    expect(input.readOnly).toBe(true);
    expect(input.getAttribute("name")).toBeNull();
  });

  it("the verified row follows emailVerified", () => {
    const { unmount } = render(
      <ProfileSettings profile={PROFILE} security={SECURITY} />,
    );
    expect(screen.getByText("Email terverifikasi")).toBeTruthy();
    unmount();

    render(
      <ProfileSettings
        profile={{ ...PROFILE, emailVerified: false }}
        security={SECURITY}
      />,
    );
    expect(screen.queryByText("Email terverifikasi")).toBeNull();
  });

  it("googleLinked switches the Akun Google row and its caption", () => {
    const { unmount } = render(
      <ProfileSettings profile={PROFILE} security={SECURITY} />,
    );
    expect(screen.getByText("Akun Google tertaut")).toBeTruthy();
    expect(
      screen.getByText(
        "rina@example.com · bisa dipakai untuk masuk satu klik",
      ),
    ).toBeTruthy();
    unmount();

    render(
      <ProfileSettings
        profile={PROFILE}
        security={{ ...SECURITY, googleLinked: false }}
      />,
    );
    expect(screen.queryByText("Akun Google tertaut")).toBeNull();
  });

  it("Sesi aktif shows the device count and the revoke action", () => {
    render(<ProfileSettings profile={PROFILE} security={SECURITY} />);
    expect(
      screen.getByRole("heading", { name: "Sesi aktif" }),
    ).toBeTruthy();
    expect(screen.getByText("2 perangkat")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Keluar dari semua perangkat" }),
    ).toBeTruthy();
  });

  it("hasPassword=false swaps the change form for the /lupa-password link", () => {
    render(
      <ProfileSettings
        profile={PROFILE}
        security={{ ...SECURITY, hasPassword: false }}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Ubah password" }),
    ).toBeNull();
    const link = screen.getByRole("link", {
      name: "Buat password lewat email",
    });
    expect(link.getAttribute("href")).toBe("/lupa-password");
  });
});
