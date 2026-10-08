// Shared auth-screen constants (card A-13). Plain module — no "use client",
// no server-only — both the (auth) server pages and the client forms import
// it, so every redirect destination is spelled once.

/**
 * Post-login destination when `?next=` is missing or unsafe to use
 * (product-owner decision, card A-13). The homepage is a placeholder today;
 * switch this to /belajar once A-14 lands — tracked in the A-13 PR notes.
 */
export const POST_LOGIN_DEFAULT_PATH = "/";

/**
 * `callbackURL` for verification links created by the CLIENT (sign-up body,
 * resend button). Better Auth redirects here after GET /api/auth/verify-email:
 * success lands clean, failures land with `?error=<CODE>` (card note c).
 * Server-initiated sends (the A-11 pre-hijack hook) still point at "/" —
 * out of A-13's file scope, noted in the PR.
 */
export const VERIFICATION_CALLBACK_PATH = "/daftar/verifikasi";

/**
 * `redirectTo` for the reset link: Better Auth's token callback endpoint
 * redirects here with `?token=<VALID>` or `?error=INVALID_TOKEN`.
 */
export const PASSWORD_RESET_REDIRECT_PATH = "/reset-password";
