// Error mapping for the A-13 auth screens — a PURE module (no React, no
// client/server directive) so pages, forms and tests all share it.
//
// Rules (product-owner decisions, card A-13):
// - Copy comes from the screen .md files (2b/3c) or the A-09/A-10 server
//   messages. NOTHING from a URL or response is ever rendered raw.
// - URL `?error=` values are whitelisted; unknown codes (e.g. Google's
//   `access_denied`) collapse into ONE generic message — never the raw
//   parameter, never a per-code leak.
// - HTTP 429 is mapped per endpoint: the "15 menit" locked copy is the
//   LOGIN bucket only (AUTH-08: 5 attempts / 15 minutes, ratelimit.ts).
//   Verification resend and forgot-password share the 3/hour/email bucket
//   and carry their own one-hour copy; the forgot-password UI must stay
//   identical for registered and unknown addresses (§14.2).

/** Better Auth error object as the client SDK surfaces it (loose on purpose). */
export type AuthErrorLike = {
  status?: number;
  code?: string;
};

export type AuthNoticeKind =
  | "invalid_credentials" // 2b: wrong email/password
  | "login_locked" // 2b: AUTH-08 bucket full (429)
  | "email_not_verified" // 2b: AUTH-03, password was correct
  | "account_not_verified" // A-11: Google identity vs unverified local account
  | "signup_rate_limited" // A-09: 429 on sign-up
  | "email_send_rate_limited" // A-10: 429 on resend / forgot-password
  | "password_policy" // AUTH-01 server-side rejection
  | "google_failed" // OAuth flow aborted/failed — generic, no details
  | "unknown"; // network/5xx — generic

export type AuthNotice = {
  kind: AuthNoticeKind;
  /** Final UI copy; never derived from untrusted text. */
  message: string;
};

const COPY: Record<AuthNoticeKind, string> = {
  invalid_credentials: "Email atau password salah. Periksa kembali dan coba lagi.",
  login_locked:
    "Terlalu banyak percobaan. Coba lagi dalam 15 menit, atau reset password.",
  email_not_verified:
    "Email Anda belum diverifikasi. Kirim ulang tautan — berlaku 24 jam.",
  account_not_verified:
    "Email ini sudah terdaftar tetapi belum diverifikasi. Kami mengirim tautan verifikasi baru ke email tersebut — buka tautannya untuk mengaktifkan akun, lalu Anda bisa masuk dengan Google.",
  signup_rate_limited:
    "Terlalu banyak percobaan pendaftaran. Coba lagi dalam 15 menit.",
  email_send_rate_limited: "Terlalu banyak permintaan. Coba lagi dalam satu jam.",
  password_policy: "Minimal 8 karakter dan mengandung huruf serta angka.",
  google_failed:
    "Tidak bisa melanjutkan dengan Google. Coba lagi, atau lanjut dengan email.",
  unknown: "Terjadi kesalahan. Coba lagi.",
};

function notice(kind: AuthNoticeKind): AuthNotice {
  return { kind, message: COPY[kind] };
}

/** POST /sign-in/email failures (2b). Unknown shapes stay generic. */
export function mapLoginError(error: AuthErrorLike): AuthNotice {
  if (error.status === 429) return notice("login_locked");
  if (error.status === 403 && error.code === "EMAIL_NOT_VERIFIED") {
    return notice("email_not_verified");
  }
  if (error.status === 401) return notice("invalid_credentials");
  return notice("unknown");
}

/** POST /sign-up/email failures. */
export function mapSignUpError(error: AuthErrorLike): AuthNotice {
  if (error.status === 429) return notice("signup_rate_limited");
  if (error.status === 400 && error.code === "PASSWORD_POLICY") {
    return notice("password_policy");
  }
  return notice("unknown");
}

/**
 * POST /request-password-reset and /send-verification-email failures — the
 * shared 3/hour/email bucket (A-10). One copy for both endpoints and for
 * registered/unknown addresses alike (§14.2).
 */
export function mapEmailSendError(error: AuthErrorLike): AuthNotice {
  if (error.status === 429) return notice("email_send_rate_limited");
  return notice("unknown");
}

/**
 * POST /reset-password: INVALID_TOKEN (expired or already used) switches the
 * FORM to the 3c "tautan sudah tidak berlaku" panel; every other failure is
 * a generic notice.
 */
export function isInvalidTokenError(error: AuthErrorLike): boolean {
  return error.status === 400 && error.code === "INVALID_TOKEN";
}

/** Generic failure notice for endpoints without a dedicated error state. */
export function unknownNotice(): AuthNotice {
  return notice("unknown");
}

/**
 * OAuth-callback `?error=` on /masuk and /daftar (A-11 stable codes land here
 * via errorCallbackURL). Whitelist: the two A-11 codes keep their copy;
 * EVERYTHING else — `access_denied`, garbage, an attacker-crafted string —
 * gets the one generic Google-failed message. The raw value is never shown.
 */
export function mapCallbackError(value: unknown): AuthNotice {
  if (value === "email_not_verified") return notice("email_not_verified");
  if (value === "account_not_verified") return notice("account_not_verified");
  return notice("google_failed");
}

/**
 * Verification-destination `?error=` (GET /api/auth/verify-email failures
 * land on /daftar/verifikasi). The four codes Better Auth can send there —
 * TOKEN_EXPIRED, INVALID_TOKEN, USER_NOT_FOUND, INVALID_USER — all map to
 * the SAME "link no longer valid" state (3c, product-owner decision).
 * An unknown non-empty value ALSO lands there: the state copy is already
 * generic (no code-specific detail, raw text never rendered) and there is
 * no other failure mode a user could act on from this page.
 */
export function isVerificationLinkError(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}

/**
 * Reset-link `?error=` (GET /api/auth/reset-password/:token failures land on
 * /reset-password). Only INVALID_TOKEN exists on that redirect; anything
 * non-empty is treated as "link no longer valid" (3c) for the same reasons
 * as isVerificationLinkError.
 */
export function isResetLinkError(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}
