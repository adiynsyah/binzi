// Who may do what inside the user domain (PRD §12.1).
//
// Two failure kinds, two HTTP statuses (see src/lib/errors.ts):
// - Ownership: resource missing or not the actor's → NotFoundError (404), so
//   the existence of other users' data is never confirmed (V-05).
// - Role: authenticated but lacking the required role → ForbiddenError (403).
//
// The schema import is type-only so policy tests run without any db setup.
import type { userRoleEnum } from "../../db/schema";
import { ForbiddenError, NotFoundError } from "../../lib/errors";

export type UserRole = (typeof userRoleEnum.enumValues)[number];

/** Minimal caller identity — Better Auth (A-09) will provide this shape. */
export type Actor = {
  id: string;
  role: UserRole;
};

// MEMBER < EDITOR < ADMIN < SUPER_ADMIN
const ROLE_RANK: Record<UserRole, number> = {
  MEMBER: 1,
  EDITOR: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

export function hasMinRole(role: UserRole, min: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** Self only — a mismatch is reported as 404, never 403 (hide existence). */
export function assertSelf(actor: Actor, userId: string): void {
  if (actor.id !== userId) {
    throw new NotFoundError("Pengguna tidak ditemukan");
  }
}

/** Self or ADMIN+. Anyone else gets 404. */
export function assertSelfOrAdmin(actor: Actor, userId: string): void {
  if (actor.id === userId || hasMinRole(actor.role, "ADMIN")) {
    return;
  }
  throw new NotFoundError("Pengguna tidak ditemukan");
}

/** Role gate for shared/admin resources — insufficient role gets 403. */
export function assertMinRole(actor: Actor, min: UserRole): void {
  if (!hasMinRole(actor.role, min)) {
    const readable = min.replaceAll("_", " ").toLowerCase();
    throw new ForbiddenError(`Aksi ini memerlukan peran ${readable}`);
  }
}
