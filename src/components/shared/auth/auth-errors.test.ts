import { describe, expect, it } from "vitest";

import {
  isInvalidTokenError,
  isResetLinkError,
  isVerificationLinkError,
  mapCallbackError,
  mapEmailSendError,
  mapLoginError,
  mapSignUpError,
} from "./auth-errors";

// Card A-13: the error mapping is the anti-enumeration surface (§14.2) —
// copy is fixed per kind, unknown shapes collapse to generic messages, and
// nothing from a URL/response is ever echoed back.

describe("mapLoginError", () => {
  it("maps a 401 to the 2b no-leak banner copy", () => {
    expect(mapLoginError({ status: 401, code: "INVALID_EMAIL_OR_PASSWORD" }))
      .toMatchObject({
        kind: "invalid_credentials",
        message: "Email atau password salah. Periksa kembali dan coba lagi.",
      });
  });

  it("maps the login 429 to the 2b locked copy with 15 menit (AUTH-08)", () => {
    expect(mapLoginError({ status: 429, code: "RATE_LIMITED" })).toMatchObject({
      kind: "login_locked",
      message: expect.stringContaining("15 menit"),
    });
  });

  it("never echoes the server's message — the UI copy comes from the status alone (A-13 fix)", () => {
    // Regression for the audit finding: the 429 body used to carry the
    // credential-failure text. Whatever the server says, the mapping keys
    // on status/code and returns its OWN final copy.
    const serverMessages = [
      "Email atau kata sandi salah",
      "Terlalu banyak percobaan. Coba lagi dalam 15 menit.",
      "attacker-controlled string <script>",
    ];
    for (const message of serverMessages) {
      const notice = mapLoginError({ status: 429, code: "RATE_LIMITED", message });
      expect(notice.kind).toBe("login_locked");
      expect(notice.message).toBe(
        "Terlalu banyak percobaan. Coba lagi dalam 15 menit, atau reset password.",
      );
    }
  });

  it("maps EMAIL_NOT_VERIFIED only through its stable code", () => {
    expect(
      mapLoginError({ status: 403, code: "EMAIL_NOT_VERIFIED" }),
    ).toMatchObject({
      kind: "email_not_verified",
      message: "Email Anda belum diverifikasi. Kirim ulang tautan — berlaku 24 jam.",
    });
    // A 403 with any other code is NOT the verification banner.
    expect(mapLoginError({ status: 403, code: "SOMETHING_ELSE" }).kind).toBe(
      "unknown",
    );
  });

  it("keeps unexpected shapes generic", () => {
    expect(mapLoginError({ status: 500 }).kind).toBe("unknown");
    expect(mapLoginError({}).kind).toBe("unknown");
  });
});

describe("mapSignUpError", () => {
  it("maps the sign-up 429 to its own copy (per-endpoint rate limits)", () => {
    expect(mapSignUpError({ status: 429, code: "SIGNUP_RATE_LIMITED" }))
      .toMatchObject({
        kind: "signup_rate_limited",
        message: "Terlalu banyak percobaan pendaftaran. Coba lagi dalam 15 menit.",
      });
  });

  it("maps the server password-policy rejection to the 2b copy", () => {
    expect(mapSignUpError({ status: 400, code: "PASSWORD_POLICY" })).toMatchObject(
      { kind: "password_policy" },
    );
  });
});

describe("mapEmailSendError", () => {
  it("shares one one-hour copy for resend and forgot-password (3/jam)", () => {
    expect(mapEmailSendError({ status: 429, code: "RATE_LIMITED" }))
      .toMatchObject({
        kind: "email_send_rate_limited",
        message: "Terlalu banyak permintaan. Coba lagi dalam satu jam.",
      });
  });

  it("stays generic otherwise", () => {
    expect(mapEmailSendError({ status: 500 }).kind).toBe("unknown");
  });
});

describe("mapCallbackError (URL ?error= whitelist)", () => {
  it("keeps the two A-11 codes with their dedicated copy", () => {
    expect(mapCallbackError("email_not_verified").kind).toBe(
      "email_not_verified",
    );
    expect(mapCallbackError("account_not_verified").message).toBe(
      "Email ini sudah terdaftar tetapi belum diverifikasi. Kami mengirim tautan verifikasi baru ke email tersebut — buka tautannya untuk mengaktifkan akun, lalu Anda bisa masuk dengan Google.",
    );
  });

  it("collapses every other value — access_denied, junk — into ONE generic message that never echoes the input", () => {
    for (const value of ["access_denied", "server_error", "<script>", "🤯"]) {
      const notice = mapCallbackError(value);
      expect(notice.kind).toBe("google_failed");
      expect(notice.message).not.toContain(value);
      expect(notice.message).toBe(
        "Tidak bisa melanjutkan dengan Google. Coba lagi, atau lanjut dengan email.",
      );
    }
  });
});

describe("link error detection", () => {
  it("treats every Better Auth verification code as the same expired state", () => {
    for (const code of [
      "TOKEN_EXPIRED",
      "INVALID_TOKEN",
      "USER_NOT_FOUND",
      "INVALID_USER",
    ]) {
      expect(isVerificationLinkError(code)).toBe(true);
    }
    expect(isVerificationLinkError(undefined)).toBe(false);
    expect(isVerificationLinkError("")).toBe(false);
  });

  it("flags reset links without a usable token", () => {
    expect(isResetLinkError("INVALID_TOKEN")).toBe(true);
    expect(isResetLinkError(undefined)).toBe(false);
  });

  it("detects INVALID_TOKEN submissions on the reset form", () => {
    expect(
      isInvalidTokenError({ status: 400, code: "INVALID_TOKEN" }),
    ).toBe(true);
    expect(isInvalidTokenError({ status: 400, code: "WEAK_PASSWORD" })).toBe(
      false,
    );
  });
});
