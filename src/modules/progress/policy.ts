// Role policy for the progress module (card S5-01 §1). Module-internal:
// the service applies this FIRST — role before any input parsing (guard
// order, src/modules/README.md). Everything the learner dashboard does is
// MEMBER+ (PRD §3.2); the route layer checks the same minimum, so the two
// layers agree by construction.
import { roleAtLeast, type SessionUser } from "@/lib/rbac";
import { ForbiddenError } from "@/lib/errors";

/**
 * MEMBER+ or 403. `roleAtLeast` fails closed for a role outside the enum
 * (unknown ranks are undefined → not >= MEMBER), which is exactly what the
 * integration test proves with a cast.
 */
export function assertMemberRole(actor: SessionUser): void {
  if (!roleAtLeast(actor.role, "MEMBER")) {
    throw new ForbiddenError("Aksi ini memerlukan peran member");
  }
}
