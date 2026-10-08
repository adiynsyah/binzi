// @vitest-environment jsdom
import "../../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RegisterForm } from "./register-form";
import { authClient } from "./auth-client";

// Card A-13: the registration form's 3a/3c states — the consent gate, the
// per-field copy, the live password pills, and the anti-enumeration success
// panel (§14.2): a 200 shows the SAME "check your email" copy whether the
// address is fresh or already registered.

vi.mock("./auth-client", () => ({
  authClient: {
    signUp: { email: vi.fn() },
  },
}));

vi.mock("./turnstile-widget", () => ({
  TurnstileWidget: () => <div data-testid="turnstile-widget" />,
}));

const signUpEmail = vi.mocked(authClient.signUp.email);

// The consent Checkbox lives inside a <form>, so Radix mounts its hidden
// bubble input, which measures itself with ResizeObserver — not implemented
// in jsdom (ui/checkbox.test.tsx passes only because it renders outside a
// form). Standalone Checkbox tests elsewhere don't need this stub.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (!("ResizeObserver" in globalThis)) {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
}

function renderForm(overrides: Partial<Parameters<typeof RegisterForm>[0]> = {}) {
  const props = {
    googleEnabled: false,
    turnstileSiteKey: null,
    initialError: null,
    ...overrides,
  };
  return render(<RegisterForm {...props} />);
}

function fillValidValues() {
  fireEvent.change(screen.getByLabelText("Nama lengkap"), {
    target: { value: "Rina Kusuma" },
  });
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

describe("RegisterForm", () => {
  it("demands consent with the 3c copy", async () => {
    renderForm();
    fillValidValues();
    fireEvent.click(screen.getByRole("button", { name: "Buat Akun Gratis" }));
    expect(
      await screen.findByText("Centang persetujuan untuk melanjutkan"),
    ).toBeTruthy();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("shows per-field copy for an empty name", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Buat Akun Gratis" }));
    expect(await screen.findByText("Nama wajib diisi")).toBeTruthy();
  });

  it("renders the live password-rule pills (3a)", () => {
    renderForm();
    expect(screen.getByText("8 karakter")).toBeTruthy();
    expect(screen.getByText("ada huruf")).toBeTruthy();
    expect(screen.getByText("ada angka")).toBeTruthy();
  });

  it("sends the verification callbackURL with the sign-up", async () => {
    signUpEmail.mockResolvedValue({ data: { user: { id: "u1" } }, error: null } as never);
    renderForm();
    fillValidValues();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Buat Akun Gratis" }));
    await waitFor(() => {
      expect(signUpEmail).toHaveBeenCalledWith(
        {
          name: "Rina Kusuma",
          email: "rina@email.com",
          password: "binzi2026",
          callbackURL: "/daftar/verifikasi",
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-captcha-response": expect.any(String),
          }),
        }),
      );
    });
  });

  it("shows the identical check-your-email panel on success (no enumeration)", async () => {
    signUpEmail.mockResolvedValue({ data: { user: { id: "u1" } }, error: null } as never);
    renderForm();
    fillValidValues();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Buat Akun Gratis" }));
    expect(await screen.findByText("Cek email Anda.")).toBeTruthy();
    expect(
      screen.getByText(
        /Jika alamat ini belum terdaftar, kami mengirim tautan verifikasi yang berlaku 24 jam/,
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Masuk" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "reset password" })).toBeTruthy();
  });

  it("maps the sign-up 429 to its dedicated copy", async () => {
    signUpEmail.mockResolvedValue({
      data: null,
      error: { status: 429, code: "SIGNUP_RATE_LIMITED" } as never,
    });
    renderForm();
    fillValidValues();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Buat Akun Gratis" }));
    expect(
      await screen.findByText(
        "Terlalu banyak percobaan pendaftaran. Coba lagi dalam 15 menit.",
      ),
    ).toBeTruthy();
  });

  it("hides the Google button and its helper when the provider is inactive", () => {
    renderForm({ googleEnabled: false });
    expect(
      screen.queryByRole("button", { name: /Daftar dengan Google/ }),
    ).toBeNull();
    expect(screen.queryByText(/Tanpa verifikasi email/)).toBeNull();
  });
});
