// @vitest-environment jsdom
import "../../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "./login-form";
import { authClient } from "./auth-client";

// Card A-13: the login form's 2b states — per-field copy, the no-leak
// banner, the locked dark toast, the unverified-email banner with its
// resend action, and the success state. The auth client and the Turnstile
// widget are mocked: these tests assert CONTRACT and COPY, not network.

vi.mock("./auth-client", () => ({
  authClient: {
    signIn: { email: vi.fn() },
    sendVerificationEmail: vi.fn(),
  },
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const signInEmail = vi.mocked(authClient.signIn.email);
const sendVerificationEmail = vi.mocked(authClient.sendVerificationEmail);

function renderForm(overrides: Partial<Parameters<typeof LoginForm>[0]> = {}) {
  const props = {
    nextPath: null,
    googleEnabled: false,
    turnstileSiteKey: null,
    initialError: null,
    ...overrides,
  };
  return render(<LoginForm {...props} />);
}

function fillValidCredentials() {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "rina@email.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "binzi2026" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LoginForm", () => {
  it("shows the 2b per-field copy, not the schema's raw messages", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
    expect(
      await screen.findByText("Format email belum benar — contoh: nama@email.com"),
    ).toBeTruthy();
    expect(
      screen.getByText("Minimal 8 karakter dan mengandung huruf serta angka"),
    ).toBeTruthy();
  });

  it("renders the Google button and divider only when the server enables it", () => {
    renderForm({ googleEnabled: true });
    expect(
      screen.getByRole("button", { name: /Masuk dengan Google/ }),
    ).toBeTruthy();
    expect(screen.getByText("atau pakai email")).toBeTruthy();
  });

  it("hides the Google button when the provider is inactive", () => {
    renderForm({ googleEnabled: false });
    expect(
      screen.queryByRole("button", { name: /Masuk dengan Google/ }),
    ).toBeNull();
  });

  it("maps a 401 to the no-leak banner (§14.2)", async () => {
    signInEmail.mockResolvedValue({
      data: null,
      error: { status: 401, code: "INVALID_EMAIL_OR_PASSWORD" } as never,
    });
    renderForm();
    fillValidCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
    expect(
      await screen.findByText(
        "Email atau password salah. Periksa kembali dan coba lagi.",
      ),
    ).toBeTruthy();
  });

  it("maps the 429 to the locked dark toast with the reset escape hatch", async () => {
    signInEmail.mockResolvedValue({
      data: null,
      error: { status: 429, code: "RATE_LIMITED" } as never,
    });
    renderForm();
    fillValidCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Terlalu banyak percobaan");
    expect(alert.textContent).toContain("15 menit");
    expect(
      screen.getByRole("link", { name: "reset password" }),
    ).toBeTruthy();
    // 2b (A-13 fix): the left badge is a CLOCK icon, not the "15" count —
    // matching the icon pattern of the wrong-credentials banner.
    expect(alert.querySelector("svg")).toBeTruthy();
    expect(alert.querySelector("svg.lucide-clock")).toBeTruthy();
    const badge = alert.querySelector("span");
    expect(badge?.textContent ?? "").toBe("");
  });

  it("shows the resend action for EMAIL_NOT_VERIFIED and sends to the verification destination", async () => {
    signInEmail.mockResolvedValue({
      data: null,
      error: { status: 403, code: "EMAIL_NOT_VERIFIED" } as never,
    });
    sendVerificationEmail.mockResolvedValue({ data: null, error: null });
    renderForm();
    fillValidCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));

    const resend = await screen.findByRole("button", {
      name: "Kirim ulang tautan",
    });
    fireEvent.click(resend);
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

  it("resend waits for a FRESH token: the sign-in consumed the old one (AUTH-10)", async () => {
    signInEmail.mockResolvedValue({
      data: null,
      error: { status: 403, code: "EMAIL_NOT_VERIFIED" } as never,
    });
    sendVerificationEmail.mockResolvedValue({ data: null, error: null });
    renderForm({ turnstileSiteKey: "site-key" });

    // Pass the challenge, sign in, and land on EMAIL_NOT_VERIFIED.
    fireEvent.click(screen.getByTestId("turnstile-widget"));
    fillValidCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));

    // The submit consumed the single-use token and resetCaptcha() dropped
    // it: the resend must be DISABLED until the remounted widget produces
    // a fresh one — reusing the old token would be rejected 403.
    const resend = await screen.findByRole("button", {
      name: "Kirim ulang tautan",
    });
    expect((resend as HTMLButtonElement).disabled).toBe(true);

    // Fresh challenge passes — only now may the resend leave.
    fireEvent.click(screen.getByTestId("turnstile-widget"));
    expect((resend as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(resend);
    await waitFor(() => {
      expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
    });
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      { email: "rina@email.com", callbackURL: "/daftar/verifikasi" },
      { headers: { "x-captcha-response": "tok-123" } },
    );
    expect(
      screen.getByText(/Tautan verifikasi baru sudah dikirim/),
    ).toBeTruthy();
  });

  it("switches to the success state on a valid sign-in", async () => {
    signInEmail.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    } as never);
    renderForm({ nextPath: "/belajar/materi-2" });
    fillValidCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
    expect(await screen.findByText("Berhasil masuk")).toBeTruthy();
  });

  it("renders a whitelisted OAuth callback notice without echoing the raw parameter", () => {
    renderForm({
      initialError: {
        kind: "account_not_verified",
        message:
          "Email ini sudah terdaftar tetapi belum diverifikasi. Kami mengirim tautan verifikasi baru ke email tersebut — buka tautannya untuk mengaktifkan akun, lalu Anda bisa masuk dengan Google.",
      },
    });
    expect(
      screen.getByText(/Email ini sudah terdaftar tetapi belum diverifikasi/),
    ).toBeTruthy();
  });
});
