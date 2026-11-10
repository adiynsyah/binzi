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

import type { ContentStatus } from "./schema";

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

// Card S1-08 §2: submit vs publish roles. Submit is EDITOR-exactly by
// product decision ("ahli gizi mengirim"), not roleAtLeast — an ADMIN
// filling in for an editor still goes through the same submit actor, but
// the route itself only grants EDITOR+ (assertCanManageCourses) and then
// demands the exact role here, so ADMIN/SUPER_ADMIN get 403 too. Keep the
// two functions separate from assertCanManageCourses: the route layers
// them (manage → exact role), matching the guard-order rule.
/** Card §2: only an EDITOR may send a course for approval (exact role). */
export function canSubmitRole(role: UserRole): boolean {
  return role === "EDITOR";
}

/** Card §2: ADMIN and above may approve & publish. */
export function canPublishRole(role: UserRole): boolean {
  return roleAtLeast(role, "ADMIN");
}

/**
 * Per-status action flags for the builder UI (card §3) — one source for
 * which buttons render, mirroring the server gates so the client never
 * offers an action the API would 403.
 */
export type CourseActions = {
  canSubmit: boolean;
  canPublish: boolean;
};

export function courseActionsFor(role: UserRole, status: ContentStatus): CourseActions {
  return {
    canSubmit: canSubmitRole(role) && status === "DRAFT",
    canPublish: canPublishRole(role) && status === "IN_REVIEW",
  };
}
