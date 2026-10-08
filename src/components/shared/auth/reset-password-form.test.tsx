// @vitest-environment jsdom
import "../../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResetPasswordForm } from "./reset-password-form";
import { authClient } from "./auth-client";

// Card A-13: reset form (3b right) — the static validity pill, the
// match check, and the switch to the 3c expired panel when the token was
// consumed or lapsed between opening the link and submitting.

vi.mock("./auth-client", () => ({
  authClient: { resetPassword: vi.fn() },
}));

const resetPassword = vi.mocked(authClient.resetPassword);

beforeEach(() => {
  vi.clearAllMocks();
});

function fillMatchingPasswords() {
  fireEvent.change(screen.getByLabelText("Password baru"), {
    target: { value: "binzi2026" },
  });
  fireEvent.change(screen.getByLabelText("Ulangi password baru"), {
    target: { value: "binzi2026" },
  });
}

describe("ResetPasswordForm", () => {
  it("shows the static validity pill (no invented countdown)", () => {
    render(<ResetPasswordForm token="tok_123" />);
    expect(screen.getByText("Tautan valid")).toBeTruthy();
  });

  it("rejects mismatched confirmation", async () => {
    render(<ResetPasswordForm token="tok_123" />);
    fireEvent.change(screen.getByLabelText("Password baru"), {
      target: { value: "binzi2026" },
    });
    fireEvent.change(screen.getByLabelText("Ulangi password baru"), {
      target: { value: "binzi2027" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Simpan password baru" }));
    expect(await screen.findByText("Kedua password belum sama")).toBeTruthy();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("submits the token from the link", async () => {
    resetPassword.mockResolvedValue({ data: { status: true }, error: null } as never);
    render(<ResetPasswordForm token="tok_123" />);
    fillMatchingPasswords();
    fireEvent.click(screen.getByRole("button", { name: "Simpan password baru" }));
    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith({
        token: "tok_123",
        newPassword: "binzi2026",
      });
    });
    expect(await screen.findByText("Password baru disimpan.")).toBeTruthy();
  });

  it("switches to the 3c expired panel on INVALID_TOKEN", async () => {
    resetPassword.mockResolvedValue({
      data: null,
      error: { status: 400, code: "INVALID_TOKEN" } as never,
    });
    render(<ResetPasswordForm token="tok_used" />);
    fillMatchingPasswords();
    fireEvent.click(screen.getByRole("button", { name: "Simpan password baru" }));
    expect(
      await screen.findByText("Tautan ini sudah tidak berlaku"),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Minta tautan baru" }),
    ).toBeTruthy();
  });
});
