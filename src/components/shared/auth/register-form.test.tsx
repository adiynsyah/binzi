// @vitest-environment jsdom
import "../../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RegisterForm } from "./register-form";
import { authClient } from "./auth-client";
import { CAPTCHA_WAIT_COPY } from "./constants";

// Card A-13: the registration form's 3a/3c states — the consent gate, the
// per-field copy, the live password pills, and the anti-enumeration success
// panel (§14.2): a 200 shows the SAME "check your email" copy whether the
// address is fresh or already registered.

vi.mock("./auth-client", () => ({
  authClient: {
    signUp: { email: vi.fn() },
    signIn: { social: vi.fn() },
  },
}));

// The widget mocks as a button whose click fires onVerify, standing in
// for the real challenge passing (same contract as the other form tests —
// C-08 exercises the unarmed→armed transition here).
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

const signUpEmail = vi.mocked(authClient.signUp.email);
const signInSocial = vi.mocked(authClient.signIn.social);

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

  it("starts the Google sign-up toward the post-login default", () => {
    // /daftar reads no ?next= — the button must carry the constant, never a
    // hard-coded destination (regression: this call site once sent "/").
    renderForm({ googleEnabled: true });
    fireEvent.click(
      screen.getByRole("button", { name: "Daftar dengan Google" }),
    );
    expect(signInSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/masuk/lanjut",
      errorCallbackURL: "/daftar",
    });
  });

  it("hides the Google button and its helper when the provider is inactive", () => {
    renderForm({ googleEnabled: false });
    expect(
      screen.queryByRole("button", { name: /Daftar dengan Google/ }),
    ).toBeNull();
    expect(screen.queryByText(/Tanpa verifikasi email/)).toBeNull();
  });

  // ------------------------------------------------- C-08 e: focus on error

  it("memindahkan fokus ke isian kata sandi yang salah", async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Nama lengkap"), {
      target: { value: "Rina Kusuma" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "rina@email.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "pendek" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buat Akun Gratis" }));
    // PasswordField now forwards its ref (C-08 e), so RHF's
    // focus-first-error lands on the offending input.
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText("Password"));
    });
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("memindahkan fokus ke checkbox persetujuan yang kosong", async () => {
    renderForm();
    fillValidValues();
    fireEvent.click(screen.getByRole("button", { name: "Buat Akun Gratis" }));
    // The consent Checkbox receives field.ref (Radix forwards it to the
    // root button), so the missing consent is focused, not just flagged.
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("checkbox"));
    });
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  // ------------------------------------------------- C-08 a: captcha wait

  it("Enter dan klik tanpa token: tidak ada request, tombol aria-disabled & pesan tunggu", async () => {
    const { container } = renderForm({ turnstileSiteKey: "site-key" });
    const submit = screen.getByRole("button", {
      name: "Buat Akun Gratis",
    }) as HTMLButtonElement;
    expect(submit.getAttribute("aria-disabled")).toBe("true");
    expect(submit.disabled).toBe(false);
    expect(screen.getByRole("status").textContent).toBe("");

    fillValidValues();
    // Consent must pass validation FIRST — the card allows field validation
    // to run; the guard only owns the request (C-08 a2).
    fireEvent.click(screen.getByRole("checkbox"));
    // Enter: RHF's resolver is async, so the guard runs after a microtask —
    // findByText waits for the notice; only then is "no request" meaningful.
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);
    expect(await screen.findByText(CAPTCHA_WAIT_COPY)).toBeTruthy();
    expect(signUpEmail).not.toHaveBeenCalled();

    // A direct click on the aria-disabled button hits the same guard.
    fireEvent.click(submit);
    await waitFor(() => {
      expect(signUpEmail).not.toHaveBeenCalled();
      expect(screen.getByText(CAPTCHA_WAIT_COPY)).toBeTruthy();
    });

    // The challenge passes: attribute and notice lift, the header carries
    // the fresh token.
    fireEvent.click(screen.getByTestId("turnstile-widget"));
    expect(submit.getAttribute("aria-disabled")).toBeNull();
    expect(screen.queryByText(CAPTCHA_WAIT_COPY)).toBeNull();
    fireEvent.click(submit);
    await waitFor(() => {
      expect(signUpEmail).toHaveBeenCalledTimes(1);
    });
    expect(signUpEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: "rina@email.com" }),
      {
        headers: { "x-captcha-response": "tok-123" },
      },
    );
  });

  // ------------------------------------------------- C-08 f: Google start

  it("menampilkan banner generik bila awal Google gagal dimulai", async () => {
    signInSocial.mockResolvedValue({
      data: null,
      error: { status: 500 } as never,
    });
    renderForm({ googleEnabled: true });
    fireEvent.click(
      screen.getByRole("button", { name: /Daftar dengan Google/ }),
    );
    expect(
      await screen.findByText(
        "Tidak bisa melanjutkan dengan Google. Coba lagi, atau lanjut dengan email.",
      ),
    ).toBeTruthy();
  });
});
