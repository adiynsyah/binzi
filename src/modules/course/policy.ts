// Who may do what inside the course domain (card S1-01, PRD §3.2).
//
// EDITOR and above may view and edit EVERY course, no matter who created it
// (product-owner decision 24 Oct; deviates from the 19a design note "ahli
// gizi hanya melihat konten miliknya" — noted in the card and the PR).
//
// The role ladder comes from @/lib/rbac (roleAtLeast) — the ONE rank map in
// lib — instead of a third copy of ROLE_RANK.
import type { UserRole } from "@/lib/rbac";
import { roleAtLeast } from "@/lib/rbac";
import { ForbiddenError } from "@/lib/errors";

/** Minimal caller identity (same shape as the user module's Actor). */
export type Actor = {
  id: string;
  role: UserRole;
};

/**
 * Role gate for the CMS course endpoints — checked BEFORE input parsing
 * (guard order, src/modules/README.md): an unauthorized caller must not
 * learn the input contract. Insufficient role gets 403.
 */
export function assertCanManageCourses(actor: Actor): void {
  if (!roleAtLeast(actor.role, "EDITOR")) {
    throw new ForbiddenError("Aksi ini memerlukan peran editor");
  }
}
