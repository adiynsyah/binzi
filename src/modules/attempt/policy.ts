// Role + timing policy for the attempt module (card S3-01 §1). The service
// applies the role guard FIRST (guard order, src/modules/README.md); the
// ownership half of the policy lives in queries.ts (`user_id = actor` in
// every WHERE — anti-IDOR in two layers).
import { roleAtLeast, type SessionUser } from "@/lib/rbac";
import { ForbiddenError } from "@/lib/errors";

/**
 * The 15-second grace after `expires_at` (owner decision 7, card S3-01):
 * a save or submit whose request left the client in time may still land.
 * Server time is the only clock that counts — never a device timestamp.
 */
export const QUIZ_TOLERANCE_MS = 15_000;

/** MEMBER+ or 403 — twin of the progress module's guard (module-internal
 *  by rule; roleAtLeast itself fails closed for unknown roles). */
export function assertMemberRole(actor: SessionUser): void {
  if (!roleAtLeast(actor.role, "MEMBER")) {
    throw new ForbiddenError("Aksi ini memerlukan peran member");
  }
}

/** `now` is still inside the tolerance window of `expiresAt`. */
export function withinTolerance(now: Date, expiresAt: Date): boolean {
  return now.getTime() <= expiresAt.getTime() + QUIZ_TOLERANCE_MS;
}
