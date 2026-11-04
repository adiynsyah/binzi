// Who may do what inside the lesson domain (card S1-02, PRD §3.2).
//
// Same rank gate as the course module (S1-01 owner decision 24 Oct):
// EDITOR and above may edit EVERY lesson, no matter who created the course.
// Stated separately instead of importing course/policy.ts because policy
// files are module-internal (src/modules/README.md) — cross-module reuse
// would have to go through the other module's service door, which policy
// is not.
import type { UserRole } from "@/lib/rbac";
import { roleAtLeast } from "@/lib/rbac";
import { ForbiddenError } from "@/lib/errors";

/** Minimal caller identity (same shape as the course module's Actor). */
export type Actor = {
  id: string;
  role: UserRole;
};

/**
 * Role gate for the lesson endpoints — checked BEFORE input parsing (guard
 * order, src/modules/README.md). Insufficient role gets 403.
 */
export function assertCanManageLessons(actor: Actor): void {
  if (!roleAtLeast(actor.role, "EDITOR")) {
    throw new ForbiddenError("Aksi ini memerlukan peran editor");
  }
}
