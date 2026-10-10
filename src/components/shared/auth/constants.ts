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
 * `callbackURL` for verification links — sign-up body, resend buttons, AND
 * the A-11 pre-hijack hook. Single source lives in the auth module contract
 * so client and server sends can never drift apart. Relative import because
 * vitest has no `@/` alias and the component tests reach this file.
 */
export { VERIFICATION_CALLBACK_PATH } from "../../../modules/auth/schema";

/**
 * `redirectTo` for the reset link: Better Auth's token callback endpoint
 * redirects here with `?token=<VALID>` or `?error=INVALID_TOKEN`.
 */
export const PASSWORD_RESET_REDIRECT_PATH = "/reset-password";
