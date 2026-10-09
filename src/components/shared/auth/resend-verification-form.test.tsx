// @vitest-environment jsdom
import "../../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResendVerificationForm } from "./resend-verification-form";
import { authClient } from "./auth-client";

// Card A-13: the 3c expired-verification state. The resend must go to the
// A-10 endpoint with /daftar/verifikasi as the destination so the fresh
// link lands back HERE, and the 3/hour bucket message (429) must be the
// shared one-hour copy. The endpoint is Turnstile-protected (AUTH-10):
// the widget mocks as a button whose click fires onVerify, standing in
// for the real challenge passing.

vi.mock("./auth-client", () => ({
  authClient: { sendVerificationEmail: vi.fn() },
}));

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

const sendVerificationEmail = vi.mocked(authClient.sendVerificationEmail);

beforeEach(() => {
  vi.clearAllMocks();
});

function submit(email: string) {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Kirim tautan verifikasi baru" }),
  );
}

describe("ResendVerificationForm", () => {
  it("shows the 3c copy", () => {
    render(<ResendVerificationForm turnstileSiteKey={null} />);
    expect(screen.getByText("Akun Anda belum aktif.")).toBeTruthy();
    expect(
      screen.getByText(
        "Kirim tautan verifikasi baru — yang lama otomatis dibatalkan.",
      ),
    ).toBeTruthy();
  });

  it("sends the resend to /daftar/verifikasi (the fresh link returns here)", async () => {
    sendVerificationEmail.mockResolvedValue({ data: null, error: null });
    render(<ResendVerificationForm turnstileSiteKey={null} />);
    submit("rina@email.com");
    await waitFor(() => {
      expect(sendVerificationEmail).toHaveBeenCalledWith(
        {
          email: "rina@email.com",
          callbackURL: "/daftar/verifikasi",
        },
        { headers: { "x-captcha-response": "" } },
      );
    });
    expect(
      screen.getByText(/Tautan verifikasi baru sudah dikirim/),
    ).toBeTruthy();
  });

  it("maps the 3/hour bucket to the one-hour copy", async () => {
    sendVerificationEmail.mockResolvedValue({
      data: null,
      error: { status: 429, code: "RATE_LIMITED" } as never,
    });
    render(<ResendVerificationForm turnstileSiteKey={null} />);
    submit("rina@email.com");
    expect(
      await screen.findByText("Terlalu banyak permintaan. Coba lagi dalam satu jam."),
    ).toBeTruthy();
  });

  it("gates the submit on a Turnstile token and sends it in the header", async () => {
    sendVerificationEmail.mockResolvedValue({ data: null, error: null });
    render(<ResendVerificationForm turnstileSiteKey="site-key" />);

    const submitButton = screen.getByRole("button", {
      name: "Kirim tautan verifikasi baru",
    });
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("turnstile-widget")).toBeTruthy();

    // The challenge "passes" — only now may the request leave.
    fireEvent.click(screen.getByTestId("turnstile-widget"));
    expect((submitButton as HTMLButtonElement).disabled).toBe(false);

    submit("rina@email.com");
    await waitFor(() => {
      expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
    });
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      { email: "rina@email.com", callbackURL: "/daftar/verifikasi" },
      { headers: { "x-captcha-response": "tok-123" } },
    );
  });

  it("hides the widget entirely when the server provides no sitekey", () => {
    render(<ResendVerificationForm turnstileSiteKey={null} />);
    expect(screen.queryByTestId("turnstile-widget")).toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: "Kirim tautan verifikasi baru",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
});
