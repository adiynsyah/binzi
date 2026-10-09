// @vitest-environment jsdom
import "../../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm } from "./forgot-password-form";
import { authClient } from "./auth-client";

// Card A-13 fix: the forgot-password form is Turnstile-protected like
// sign-in/sign-up (AUTH-10). The widget mocks as a button whose click
// fires onVerify, standing in for the real challenge passing. Contract
// and copy only — no network.

vi.mock("./auth-client", () => ({
  authClient: { requestPasswordReset: vi.fn() },
}));

vi.mock("./google-button", () => ({ startGoogleSignIn: vi.fn() }));

vi.mock("./turnstile-widget", () => ({
  TurnstileWidget: ({ onVerify }: { onVerify: (token: string) => void }) => (
    <button
      type="button"
      data-testid="turnstile-widget"
      onClick={() => onVerify("tok-123")}
    >
      turnstile
    </button>
  ),
}));

const requestPasswordReset = vi.mocked(authClient.requestPasswordReset);

beforeEach(() => {
  vi.clearAllMocks();
});

function fillEmail(email: string) {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
}

describe("ForgotPasswordForm", () => {
  it("shows the 2b/3b per-field email copy on invalid submit", async () => {
    render(
      <ForgotPasswordForm googleEnabled={false} turnstileSiteKey={null} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Kirim tautan reset" }));
    expect(
      await screen.findByText(
        "Format email belum benar — contoh: nama@email.com",
      ),
    ).toBeTruthy();
  });

  it("sends the request with the reset destination and captcha header", async () => {
    requestPasswordReset.mockResolvedValue({ data: null, error: null });
    render(
      <ForgotPasswordForm googleEnabled={false} turnstileSiteKey={null} />,
    );
    fillEmail("rina@email.com");
    fireEvent.click(screen.getByRole("button", { name: "Kirim tautan reset" }));
    await waitFor(() => {
      expect(requestPasswordReset).toHaveBeenCalledTimes(1);
    });
    expect(requestPasswordReset).toHaveBeenCalledWith(
      { email: "rina@email.com", redirectTo: "/reset-password" },
      { headers: { "x-captcha-response": "" } },
    );
    // §14.2: the generic "check your email" panel — same shape for
    // registered and unknown addresses.
    expect(screen.getByText("Periksa email Anda.")).toBeTruthy();
  });

  it("gates the submit on a Turnstile token and sends it in the header", async () => {
    requestPasswordReset.mockResolvedValue({ data: null, error: null });
    render(
      <ForgotPasswordForm googleEnabled={false} turnstileSiteKey="site-key" />,
    );

    const submitButton = screen.getByRole("button", {
      name: "Kirim tautan reset",
    });
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("turnstile-widget")).toBeTruthy();

    fireEvent.click(screen.getByTestId("turnstile-widget"));
    expect((submitButton as HTMLButtonElement).disabled).toBe(false);

    fillEmail("rina@email.com");
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(requestPasswordReset).toHaveBeenCalledTimes(1);
    });
    expect(requestPasswordReset).toHaveBeenCalledWith(
      { email: "rina@email.com", redirectTo: "/reset-password" },
      { headers: { "x-captcha-response": "tok-123" } },
    );
  });

  it("maps the 3/hour bucket to the one-hour copy", async () => {
    requestPasswordReset.mockResolvedValue({
      data: null,
      error: { status: 429, code: "RATE_LIMITED" } as never,
    });
    render(
      <ForgotPasswordForm googleEnabled={false} turnstileSiteKey={null} />,
    );
    fillEmail("rina@email.com");
    fireEvent.click(screen.getByRole("button", { name: "Kirim tautan reset" }));
    expect(
      await screen.findByText(
        "Terlalu banyak permintaan. Coba lagi dalam satu jam.",
      ),
    ).toBeTruthy();
  });

  it("offers the Google escape hatch only when the provider is active", () => {
    render(
      <ForgotPasswordForm googleEnabled={true} turnstileSiteKey={null} />,
    );
    expect(
      screen.getByText(/Akun itu tidak punya password/),
    ).toBeTruthy();
  });
});
