// @vitest-environment jsdom
import "../../ui/test-env";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "./login-form";
import { authClient } from "./auth-client";
import { CAPTCHA_WAIT_COPY } from "./constants";

// Card A-13: the login form's 2b states — per-field copy, the no-leak
// banner, the locked dark toast, the unverified-email banner with its
// resend action, and the success state. The auth client and the Turnstile
// widget are mocked: these tests assert CONTRACT and COPY, not network.

vi.mock("./auth-client", () => ({
  authClient: {
    signIn: { email: vi.fn(), social: vi.fn() },
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

// Hoisted so the next/navigation factory (itself hoisted above this module)
// can hand the same spies to every test that needs to assert navigation.
const { routerReplace, routerRefresh } = vi.hoisted(() => ({
  routerReplace: vi.fn(),
  routerRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: routerReplace, refresh: routerRefresh }),
}));

const signInEmail = vi.mocked(authClient.signIn.email);
const signInSocial = vi.mocked(authClient.signIn.social);
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

  it("starts the Google flow toward the post-login default without ?next=", () => {
    // A missing OR unsafe ?next= collapses to nextPath=null at the page
    // (safeInternalRedirectPath) — the button then carries the default.
    renderForm({ googleEnabled: true });
    fireEvent.click(
      screen.getByRole("button", { name: /Masuk dengan Google/ }),
    );
    expect(signInSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/masuk/lanjut",
      errorCallbackURL: "/masuk",
    });
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
    // it: the resend stays aria-disabled (C-08: reachable but marked)
    // until the remounted widget produces a fresh one — reusing the old
    // token would be rejected 403.
    const resend = await screen.findByRole("button", {
      name: "Kirim ulang tautan",
    });
    expect(resend.getAttribute("aria-disabled")).toBe("true");
    expect((resend as HTMLButtonElement).disabled).toBe(false);

    // Fresh challenge passes — only now may the resend leave.
    fireEvent.click(screen.getByTestId("turnstile-widget"));
    expect(resend.getAttribute("aria-disabled")).toBeNull();
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

  it("remounts the error banner on each new submit", async () => {
    // Deferred promises: an instantly-resolving mock lets React coalesce
    // setNotice(null) and the next error into ONE render (no unmount). A
    // pending request mirrors real wire latency, where the clear commits
    // first and the banner truly remounts.
    let resolveSignIn!: (error: unknown) => void;
    signInEmail.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignIn = (error) => resolve({ data: null, error } as never);
        }),
    );
    renderForm();
    fillValidCredentials();

    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledTimes(1);
    });
    resolveSignIn({ status: 403, code: "EMAIL_NOT_VERIFIED" });
    const first = await screen.findByRole("alert");
    expect(first.textContent).toContain("Email Anda belum diverifikasi.");

    // The in-flight attempt first clears the old banner...
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
    // ...then the failure mounts a FRESH banner (new node — role="alert"
    // is announced again), never a mutation of the previous instance.
    resolveSignIn({ status: 403, code: "EMAIL_NOT_VERIFIED" });
    const second = await screen.findByRole("alert");
    expect(second).not.toBe(first);
    expect(second.textContent).toContain("Email Anda belum diverifikasi.");
  });

  it("restores the resend action after a new submit", async () => {
    signInEmail.mockResolvedValue({
      data: null,
      error: { status: 403, code: "EMAIL_NOT_VERIFIED" } as never,
    });
    sendVerificationEmail.mockResolvedValue({ data: null, error: null });
    renderForm();
    fillValidCredentials();

    // Land on the unverified banner and use the resend action once.
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Kirim ulang tautan" }),
    );
    expect(
      await screen.findByText(/Tautan verifikasi baru sudah dikirim/),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Kirim ulang tautan" }),
    ).toBeNull();

    // The next sign-in attempt resets resendState: the action must return
    // instead of sticking on the "sudah dikirim" description.
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
    expect(
      await screen.findByRole("button", { name: "Kirim ulang tautan" }),
    ).toBeTruthy();
    expect(screen.queryByText(/sudah dikirim/)).toBeNull();
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

  it("redirects the success state to the post-login default without ?next=", async () => {
    signInEmail.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    } as never);
    renderForm();
    fillValidCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
    expect(await screen.findByText("Berhasil masuk")).toBeTruthy();
    // The banner shows briefly, then the router takes over after 700ms —
    // real timers, so allow a generous waitFor window.
    await waitFor(
      () => expect(routerReplace).toHaveBeenCalledWith("/masuk/lanjut"),
      { timeout: 2000 },
    );
    expect(routerRefresh).toHaveBeenCalled();
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

  // ------------------------------------------------- C-08 a: captcha wait

  it("Enter tanpa token: tidak ada request, pesan tunggu di wadah status", async () => {
    const { container } = renderForm({ turnstileSiteKey: "site-key" });
    // The wait container is in the DOM BEFORE any activation (empty), so
    // filling it is announced — Enter happens in an input, where the
    // button's aria-describedby is never read (owner decision, C-08).
    const waitRegion = screen.getByRole("status");
    expect(waitRegion.textContent).toBe("");

    fillValidCredentials();
    // Enter in a field = the form's implicit submission. RHF's resolver is
    // async, so the guard runs after a microtask — findByText waits for the
    // notice, and only then is "no request" meaningful.
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    expect(await screen.findByText(CAPTCHA_WAIT_COPY)).toBeTruthy();
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("klik tombol aria-disabled tanpa token: tidak ada request; tombol tetap fokus", async () => {
    renderForm({ turnstileSiteKey: "site-key" });
    const submit = screen.getByRole("button", {
      name: "Masuk",
    }) as HTMLButtonElement;
    expect(submit.getAttribute("aria-disabled")).toBe("true");
    expect(submit.disabled).toBe(false);
    submit.focus();
    expect(document.activeElement).toBe(submit);

    fillValidCredentials();
    fireEvent.click(submit);
    await waitFor(() => {
      expect(signInEmail).not.toHaveBeenCalled();
      expect(screen.getByText(CAPTCHA_WAIT_COPY)).toBeTruthy();
    });
  });

  it("setelah token masuk: atribut & pesan hilang, header membawa token", async () => {
    signInEmail.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    } as never);
    renderForm({ turnstileSiteKey: "site-key" });

    // Activate without a token first: the wait notice shows (async
    // resolver — findByText, not a synchronous query).
    fillValidCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
    expect(await screen.findByText(CAPTCHA_WAIT_COPY)).toBeTruthy();

    // The challenge passes: attribute and notice lift together.
    fireEvent.click(screen.getByTestId("turnstile-widget"));
    const submit = screen.getByRole("button", { name: "Masuk" });
    expect(submit.getAttribute("aria-disabled")).toBeNull();
    expect(screen.queryByText(CAPTCHA_WAIT_COPY)).toBeNull();

    fireEvent.click(submit);
    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledTimes(1);
    });
    expect(signInEmail).toHaveBeenCalledWith(
      { email: "rina@email.com", password: "binzi2026" },
      { headers: { "x-captcha-response": "tok-123" } },
    );
  });

  it("klik 'Kirim ulang tautan' tanpa token: tidak ada request, pesan tunggu di banner", async () => {
    signInEmail.mockResolvedValue({
      data: null,
      error: { status: 403, code: "EMAIL_NOT_VERIFIED" } as never,
    });
    sendVerificationEmail.mockResolvedValue({ data: null, error: null });
    renderForm({ turnstileSiteKey: "site-key" });

    // Pass the challenge, sign in, land on the unverified banner — the
    // submit consumed the token, so the resend starts unarmed.
    fireEvent.click(screen.getByTestId("turnstile-widget"));
    fillValidCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));

    const resend = await screen.findByRole("button", {
      name: "Kirim ulang tautan",
    });
    expect(resend.getAttribute("aria-disabled")).toBe("true");
    expect((resend as HTMLButtonElement).disabled).toBe(false);
    resend.focus();
    expect(document.activeElement).toBe(resend);

    // The handler guard holds the request; the SAME wait copy shows inside
    // the banner, after the link (C-08 a3).
    fireEvent.click(resend);
    expect(sendVerificationEmail).not.toHaveBeenCalled();
    expect(screen.getByText(CAPTCHA_WAIT_COPY)).toBeTruthy();

    // Fresh challenge passes → the resend leaves with the new token.
    fireEvent.click(screen.getByTestId("turnstile-widget"));
    fireEvent.click(resend);
    await waitFor(() => {
      expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
    });
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      { email: "rina@email.com", callbackURL: "/daftar/verifikasi" },
      { headers: { "x-captcha-response": "tok-123" } },
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
      screen.getByRole("button", { name: /Masuk dengan Google/ }),
    );
    expect(
      await screen.findByText(
        "Tidak bisa melanjutkan dengan Google. Coba lagi, atau lanjut dengan email.",
      ),
    ).toBeTruthy();
  });
});
