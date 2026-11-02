// @vitest-environment jsdom
import "../../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm } from "./forgot-password-form";
import { authClient } from "./auth-client";
import { CAPTCHA_WAIT_COPY } from "./constants";

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
    }) as HTMLButtonElement;
    // C-08: unarmed = aria-disabled but NOT natively disabled — the
    // control stays reachable; the handler guard owns the request.
    expect(submitButton.getAttribute("aria-disabled")).toBe("true");
    expect(submitButton.disabled).toBe(false);
    expect(screen.getByTestId("turnstile-widget")).toBeTruthy();

    // Activation without a token: no request, the wait notice shows (RHF's
    // resolver is async — findByText, not a synchronous query).
    fillEmail("rina@email.com");
    fireEvent.click(submitButton);
    expect(await screen.findByText(CAPTCHA_WAIT_COPY)).toBeTruthy();
    expect(requestPasswordReset).not.toHaveBeenCalled();

    // The challenge passes: attribute and notice lift together.
    fireEvent.click(screen.getByTestId("turnstile-widget"));
    expect(submitButton.getAttribute("aria-disabled")).toBeNull();
    expect(screen.queryByText(CAPTCHA_WAIT_COPY)).toBeNull();

    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(requestPasswordReset).toHaveBeenCalledTimes(1);
    });
    expect(requestPasswordReset).toHaveBeenCalledWith(
      { email: "rina@email.com", redirectTo: "/reset-password" },
      { headers: { "x-captcha-response": "tok-123" } },
    );
  });

  it("Enter tanpa token: tidak ada request, pesan tunggu di wadah status", async () => {
    const { container } = render(
      <ForgotPasswordForm googleEnabled={false} turnstileSiteKey="site-key" />,
    );
    const waitRegion = screen.getByRole("status");
    expect(waitRegion.textContent).toBe("");

    fillEmail("rina@email.com");
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    expect(await screen.findByText(CAPTCHA_WAIT_COPY)).toBeTruthy();
    expect(requestPasswordReset).not.toHaveBeenCalled();
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

  it("remounts the rate-limit banner on a repeated submit", async () => {
    // Deferred promise so React commits the notice-clear first (an instant
    // mock would coalesce both renders — see the login-form twin test).
    let resolveRequest!: (error: unknown) => void;
    requestPasswordReset.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = (error) => resolve({ data: null, error } as never);
        }),
    );
    render(<ForgotPasswordForm googleEnabled={false} turnstileSiteKey={null} />);
    fillEmail("rina@email.com");

    fireEvent.click(screen.getByRole("button", { name: "Kirim tautan reset" }));
    await waitFor(() => {
      expect(requestPasswordReset).toHaveBeenCalledTimes(1);
    });
    resolveRequest({ status: 429, code: "RATE_LIMITED" });
    const first = await screen.findByRole("alert");
    expect(first.textContent).toContain("Terlalu banyak permintaan");

    // This form is retried often against the 3/hour bucket: the in-flight
    // attempt clears the old banner, then the failure must mount a FRESH
    // one (new node — role="alert" re-announced), never a mutation of the
    // previous instance.
    fireEvent.click(screen.getByRole("button", { name: "Kirim tautan reset" }));
    await waitFor(() => {
      expect(requestPasswordReset).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
    resolveRequest({ status: 429, code: "RATE_LIMITED" });
    const second = await screen.findByRole("alert");
    expect(second).not.toBe(first);
    expect(second.textContent).toContain("Terlalu banyak permintaan");
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
