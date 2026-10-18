// x-cron-secret verification for scheduled-job endpoints (card A-18).
//
// Fail-closed by design: when the server has no CRON_SECRET configured,
// EVERY request is invalid — including an empty header — so the endpoint
// answers 401 instead of quietly leaving the door open. "Secret not set" is
// distinguishable from "wrong secret" only in the server log, never in the
// response. Neither value is ever logged or echoed by this module.
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time secret comparison that is safe for different lengths:
 * SHA-256 both values first, then timingSafeEqual over the two 32-byte
 * digests. Comparing the raw values with === leaks timing information, and
 * timingSafeEqual on the raw values throws when the lengths differ.
 */
export function isCronSecretValid(
  serverSecret: string | undefined,
  headerValue: string | null,
): boolean {
  // No server secret configured → nothing can ever match (fail-closed).
  if (!serverSecret) return false;
  // An absent or empty header can never equal a non-empty secret.
  if (!headerValue) return false;

  const serverDigest = createHash("sha256").update(serverSecret).digest();
  const headerDigest = createHash("sha256").update(headerValue).digest();
  return timingSafeEqual(serverDigest, headerDigest);
}
