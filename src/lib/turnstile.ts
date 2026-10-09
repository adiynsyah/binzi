// Cloudflare Turnstile server-side verification (card A-09, AUTH-10).
//
// Thin configuration wrapper around Better Auth's official captcha plugin
// (better-auth 1.7.7). The plugin verifies the token server-side on
// `onRequest` — before any endpoint logic runs — against
// challenges.cloudflare.com, forwards the client IP as `remoteip`, fails
// closed on provider errors, and reads the token from the
// `x-captcha-response` request header (the A-13 forms must send it there
// via the auth client's `fetchOptions`).
//
// Pure module (no env imports): the secret arrives via parameter so tests
// and the instance factory can pass their own values. `siteVerifyURLOverride`
// exists for tests — it points the plugin at a local mock instead of
// Cloudflare; production never sets it.
import { captcha } from "better-auth/plugins";

/**
 * AUTH-10: Turnstile protects every credential and email-triggering form.
 * NOTE: better-auth 1.7.7's captcha plugin DEFAULTS already include
 * "/request-password-reset" — this override must keep it (the A-13 audit
 * found an earlier override that dropped it, leaving the endpoint
 * unprotected). "/send-verification-email" is BINZI-added on top of the
 * defaults: the plugin matches endpoint paths generically
 * (plugins/captcha/index.mjs), so the resend endpoint is covered too.
 */
export const TURNSTILE_PROTECTED_ENDPOINTS = [
  "/sign-up/email",
  "/sign-in/email",
  "/request-password-reset",
  "/send-verification-email",
] as const;

export type TurnstileConfig = {
  secretKey: string;
  /** Tests only: base URL of a mock siteverify endpoint. */
  siteVerifyURLOverride?: string;
};

export function turnstilePlugin(config: TurnstileConfig) {
  return captcha({
    provider: "cloudflare-turnstile",
    secretKey: config.secretKey,
    endpoints: [...TURNSTILE_PROTECTED_ENDPOINTS],
    ...(config.siteVerifyURLOverride
      ? { siteVerifyURLOverride: config.siteVerifyURLOverride }
      : {}),
  });
}
