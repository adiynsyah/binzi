// Who may do what inside the quiz domain (card S1-09, PRD §3.2).
//
// Same rank gate as the course and lesson modules (S1-01 owner decision
// 24 Oct): EDITOR and above may edit EVERY quiz, no matter who created the
// owning course. Stated separately instead of importing course/policy.ts
// because policy files are module-internal (src/modules/README.md).
import type { UserRole } from "@/lib/rbac";
import { roleAtLeast } from "@/lib/rbac";
import { ForbiddenError } from "@/lib/errors";

/** Minimal caller identity (same shape as the course module's Actor). */
export type Actor = {
  id: string;
  role: UserRole;
};

/**
 * Role gate for the quiz endpoints — checked BEFORE input parsing (guard
 * order, src/modules/README.md): an unauthorized caller must not learn the
 * input contract. Insufficient role gets 403.
 */
export function assertCanManageQuizzes(actor: Actor): void {
  if (!roleAtLeast(actor.role, "EDITOR")) {
    throw new ForbiddenError("Aksi ini memerlukan peran editor");
  }
}
