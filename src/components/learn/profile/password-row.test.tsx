// @vitest-environment jsdom
import "../../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authClient } from "@/components/shared/auth/auth-client";

import { PasswordRow } from "./password-row";

// Card S5-05: the Keamanan password row — disclosure, client-side rules
// (match + letter/digit + required current), the exact changePassword
// arguments (revokeOtherSessions ALWAYS true), success collapse with the
// 3b copy + refresh, and the two dedicated error surfaces (field error for
// a wrong current password, banner for everything else).

vi.mock("@/components/shared/auth/auth-client", () => ({
  authClient: { changePassword: vi.fn() },
}));

const mockRouter = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

const changePassword = vi.mocked(authClient.changePassword);

beforeEach(() => {
  vi.clearAllMocks();
});

function openForm() {
  const toggle = screen.getByRole("button", { name: "Ubah password" });
  fireEvent.click(toggle);
  return toggle;
}

function fill(
  current: string,
  next: string,
  confirm: string = next,
) {
  fireEvent.change(screen.getByLabelText("Password saat ini"), {
    target: { value: current },
  });
  fireEvent.change(screen.getByLabelText("Password baru"), {
    target: { value: next },
  });
  fireEvent.change(screen.getByLabelText("Ulangi password baru"), {
    target: { value: confirm },
  });
}

describe("PasswordRow", () => {
  it("discloses the form via aria-expanded/aria-controls", () => {
    render(<PasswordRow hasPassword />);
    const toggle = screen.getByRole("button", { name: "Ubah password" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    const formId = toggle.getAttribute("aria-controls");
    expect(formId).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(formId!)).not.toBeNull();
    expect(screen.getByLabelText("Password saat ini")).toBeTruthy();
  });

  it("rejects a mismatched confirmation without calling the API", async () => {
    render(<PasswordRow hasPassword />);
    openForm();
    fill("Lama12345", "Baru67890", "Bedaaaa1");
    fireEvent.click(screen.getByRole("button", { name: "Simpan password" }));
    expect(
      await screen.findByText("Ulangan belum sama dengan password baru."),
    ).toBeTruthy();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("rejects a weak new password without calling the API", async () => {
    render(<PasswordRow hasPassword />);
    openForm();
    fill("Lama12345", "hanyahuruf");
    fireEvent.click(screen.getByRole("button", { name: "Simpan password" }));
    expect(
      await screen.findByText(
        "Minimal 8 karakter dan mengandung huruf serta angka.",
      ),
    ).toBeTruthy();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("rejects an empty current password without calling the API", async () => {
    render(<PasswordRow hasPassword />);
    openForm();
    fill("", "Baru67890");
    fireEvent.click(screen.getByRole("button", { name: "Simpan password" }));
    expect(
      await screen.findByText("Password saat ini wajib diisi."),
    ).toBeTruthy();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("submits with revokeOtherSessions: true, collapses, banners, refreshes, refocuses", async () => {
    changePassword.mockResolvedValue({
      data: { token: "tok_baru" },
      error: null,
    } as never);
    render(<PasswordRow hasPassword />);
    const toggle = openForm();
    fill("Lama12345", "Baru67890");
    fireEvent.click(screen.getByRole("button", { name: "Simpan password" }));

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledTimes(1);
    });
    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: "Lama12345",
      newPassword: "Baru67890",
      revokeOtherSessions: true,
    });

    expect(await screen.findByText("Password baru disimpan.")).toBeTruthy();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(document.activeElement).toBe(toggle);
    });
  });

  it("reopening after success (or a manual close) starts from empty fields", async () => {
    // RHF keeps field values across unmount (shouldUnregister: false) —
    // without reset() the reopen would show the old, now-dead password
    // (PR review finding).
    changePassword.mockResolvedValue({
      data: { token: "tok_baru" },
      error: null,
    } as never);
    render(<PasswordRow hasPassword />);
    const toggle = openForm();
    fill("Lama12345", "Baru67890");
    fireEvent.click(screen.getByRole("button", { name: "Simpan password" }));
    expect(await screen.findByText("Password baru disimpan.")).toBeTruthy();

    fireEvent.click(toggle); // reopen the collapsed form
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const current = screen.getByLabelText(
      "Password saat ini",
    ) as HTMLInputElement;
    const next = screen.getByLabelText("Password baru") as HTMLInputElement;
    const confirm = screen.getByLabelText(
      "Ulangi password baru",
    ) as HTMLInputElement;
    expect(current.value).toBe("");
    expect(next.value).toBe("");
    expect(confirm.value).toBe("");
  });

  it("INVALID_PASSWORD becomes a field error on Password saat ini (+focus), no banner", async () => {
    changePassword.mockResolvedValue({
      data: null,
      error: { status: 400, code: "INVALID_PASSWORD" },
    } as never);
    render(<PasswordRow hasPassword />);
    openForm();
    fill("Salah123", "Baru67890");
    fireEvent.click(screen.getByRole("button", { name: "Simpan password" }));

    expect(await screen.findByText("Password saat ini salah.")).toBeTruthy();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByLabelText("Password saat ini"),
      );
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mockRouter.refresh).not.toHaveBeenCalled();
  });

  it("429 becomes the login-locked banner copy", async () => {
    changePassword.mockResolvedValue({
      data: null,
      error: { status: 429, code: "RATE_LIMITED" },
    } as never);
    render(<PasswordRow hasPassword />);
    openForm();
    fill("Salah123", "Baru67890");
    fireEvent.click(screen.getByRole("button", { name: "Simpan password" }));

    expect(
      await screen.findByText(
        "Terlalu banyak percobaan. Coba lagi dalam 15 menit, atau reset password.",
      ),
    ).toBeTruthy();
  });

  it("hasPassword=false renders the /lupa-password link instead of the form", () => {
    render(<PasswordRow hasPassword={false} />);
    expect(
      screen.queryByRole("button", { name: "Ubah password" }),
    ).toBeNull();
    expect(
      screen.getByText("Akun ini belum punya password."),
    ).toBeTruthy();
    const link = screen.getByRole("link", {
      name: "Buat password lewat email",
    });
    expect(link.getAttribute("href")).toBe("/lupa-password");
  });
});
