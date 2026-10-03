// Failure counting on the `rate_limits` table (card A-09, AUTH-08, PRD §12.4).
//
// Better Auth's built-in rate limiter keys by a single identifier (email or
// IP), not IP+email, and counts every attempt — so BINZI counts FAILED
// attempts itself in per-IP+email buckets:
//
//   login:{ip}:{email}  — incremented when a sign-in attempt that passed
//                         Turnstile still fails; cleared on successful
//                         sign-in (a legit user must not stay locked out).
//   signup:{ip}:{email} — incremented when a sign-up attempt fails.
//
// Buckets expire 15 minutes after the FIRST failure in the window; the sweep
// cron for expired rows is A-18's job (reads already treat expired rows as
// reset, so correctness does not depend on the sweep).
//
// Takes the drizzle instance as a parameter so tests can pass a PGlite-backed
// instance — importing `../db` here would throw without DATABASE_URL (CI).
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { rateLimits } from "../db/schema";
import type { Db } from "../db/client";
import { normalizeEmail } from "../modules/auth/schema";

/** AUTH-08 / §12.4: 5 failed attempts per 15 minutes per IP+email. */
export const LOGIN_RATE_LIMIT = {
  max: 5,
  windowSeconds: 15 * 60,
} as const;

export type RateLimitDecision = {
  blocked: boolean;
  remainingAttempts: number;
  /** Seconds until the bucket resets (0 when not blocked). */
  retryAfterSeconds: number;
};

export function loginRateLimitKey(ip: string, email: string): string {
  return `login:${ip}:${normalizeEmail(email)}`;
}

export function signUpRateLimitKey(ip: string, email: string): string {
  return `signup:${ip}:${normalizeEmail(email)}`;
}

/** Current state of a bucket, treating an expired row as absent. */
async function readBucket(
  db: Db,
  key: string,
  max: number,
): Promise<RateLimitDecision> {
  const rows = await db
    .select({ count: rateLimits.count, expiresAt: rateLimits.expiresAt })
    .from(rateLimits)
    .where(eq(rateLimits.key, key))
    .limit(1);

  const row = rows[0];
  if (!row) return { blocked: false, remainingAttempts: max, retryAfterSeconds: 0 };

  const msLeft = row.expiresAt.getTime() - Date.now();
  if (msLeft <= 0) {
    return { blocked: false, remainingAttempts: max, retryAfterSeconds: 0 };
  }

  const remainingAttempts = Math.max(0, max - row.count);
  return {
    blocked: remainingAttempts === 0,
    remainingAttempts,
    retryAfterSeconds: Math.ceil(msLeft / 1000),
  };
}

/**
 * AUTH-08 gate: `checkLoginRateLimit` decides whether the attempt may
 * proceed. Check it BEFORE verifying credentials.
 */
export function checkLoginRateLimit(
  db: Db,
  key: string,
  max: number = LOGIN_RATE_LIMIT.max,
): Promise<RateLimitDecision> {
  return readBucket(db, key, max);
}

/**
 * Count a failed attempt. Atomic upsert: the first failure in a window
 * anchors `expires_at`; later failures only bump the counter until the
 * window lapses, after which the bucket resets to 1 with a fresh window.
 */
export async function registerFailedAttempt(
  db: Db,
  key: string,
  windowSeconds: number = LOGIN_RATE_LIMIT.windowSeconds,
): Promise<void> {
  await db
    .insert(rateLimits)
    .values({ key, count: 1, expiresAt: new Date(Date.now() + windowSeconds * 1000) })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.expiresAt} <= now() THEN 1 ELSE ${rateLimits.count} + 1 END`,
        expiresAt: sql`CASE WHEN ${rateLimits.expiresAt} <= now() THEN now() + make_interval(secs => ${windowSeconds}) ELSE ${rateLimits.expiresAt} END`,
      },
    });
}

/** Clears a bucket — called after a SUCCESSFUL sign-in (see header). */
export async function clearRateLimit(db: Db, key: string): Promise<void> {
  await db.delete(rateLimits).where(eq(rateLimits.key, key));
}

const ipv4Schema = z.ipv4();
const ipv6Schema = z.ipv6();

/** IPv4-mapped IPv6 (::ffff:203.0.113.5) collapses to the IPv4 form. */
function collapseMappedIpv6(ip: string): string {
  const lower = ip.toLowerCase();
  const match = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return match?.[1] ?? ip;
}

/**
 * Collapses an IPv6 address to its /64 prefix. A rotating-address attacker
 * inside one /64 must not get a fresh bucket per address — the email half
 * of the key alone would not stop them.
 */
function maskIpv6To64(ip: string): string {
  const [head, tail] = ip.split("::");
  const headGroups = head ? head.split(":").filter(Boolean) : [];
  const tailGroups = tail !== undefined ? tail.split(":").filter(Boolean) : [];
  const totalKnown = headGroups.length + tailGroups.length;
  const missing = tail !== undefined ? Math.max(0, 8 - totalKnown) : 0;

  let groups: string[];
  if (tail === undefined) {
    groups = headGroups;
  } else {
    groups = [
      ...headGroups,
      ...Array.from({ length: missing }, () => "0"),
      ...tailGroups,
    ];
  }

  const prefix = groups.slice(0, 4);
  while (prefix.length < 4) prefix.push("0");
  return `${prefix.map((g) => g.padStart(4, "0")).join(":")}::/64`;
}

/**
 * Normalizes a validated client IP for use in a bucket key.
 * Anything unparseable stays as-is under a distinct value.
 */
export function normalizeClientIp(ip: string): string {
  const collapsed = collapseMappedIpv6(ip);
  if (ipv4Schema.safeParse(collapsed).success) return collapsed;
  if (ipv6Schema.safeParse(collapsed).success) return maskIpv6To64(collapsed.toLowerCase());
  return "unknown";
}

/**
 * Extracts the client IP for rate-limit keying.
 *
 * On Vercel, `x-forwarded-for` is (re)written by the platform edge from the
 * incoming TCP connection — values a client sends in that header are dropped
 * — so the leftmost entry is the address Vercel observed. Locally the header
 * is trivially spoofable, which is acceptable: local dev is not a deployment.
 * An IP that fails validation falls back to `x-real-ip`, then "unknown"
 * (all unidentifiable clients share one bucket per email — fail closed).
 */
export function extractClientIp(headers: Headers | undefined): string {
  const forwarded = headers?.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first && (ipv4Schema.safeParse(first).success || ipv6Schema.safeParse(first).success)) {
    return normalizeClientIp(first);
  }

  const real = headers?.get("x-real-ip")?.trim();
  if (real && (ipv4Schema.safeParse(real).success || ipv6Schema.safeParse(real).success)) {
    return normalizeClientIp(real);
  }

  return "unknown";
}
