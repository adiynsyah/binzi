// @vitest-environment jsdom
import "../../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResetPasswordForm } from "./reset-password-form";
import { authClient } from "./auth-client";

// Card A-13: reset form (3b right) — the static validity pill, the
// match check, and the redirect to /reset-password?error=INVALID_TOKEN
// when the token was consumed or lapsed between opening the link and
// submitting (the server then renders the 3c expired panel as the page's
// only h1 — see expired-link-panel.test.tsx for that panel).

vi.mock("./auth-client", () => ({
  authClient: { resetPassword: vi.fn() },
}));

const mockRouter = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
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

  it("redirects back with ?error=INVALID_TOKEN so the server renders the 3c panel", async () => {
    resetPassword.mockResolvedValue({
      data: null,
      error: { status: 400, code: "INVALID_TOKEN" } as never,
    });
    render(<ResetPasswordForm token="tok_used" />);
    fillMatchingPasswords();
    fireEvent.click(screen.getByRole("button", { name: "Simpan password baru" }));
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith(
        "/reset-password?error=INVALID_TOKEN",
      );
    });
    // The form itself stays mounted — the expired swap is the PAGE's job.
    expect(screen.getByText("Tautan valid")).toBeTruthy();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
