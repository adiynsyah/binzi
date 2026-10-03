// Role semantics for authentication (card A-09, PRD §3.2).
//
// Pure module — type-only import from the DB schema, safe to load in tests
// and in the Better Auth instance factory without a database connection.
import type { userRoleEnum } from "../../db/schema";

export type UserRole = (typeof userRoleEnum.enumValues)[number];

/**
 * Roles above MEMBER ("staf"). Staff sessions are capped at 8 hours
 * (AUTH-07); member sessions last 30 days.
 */
export const STAFF_ROLES = [
  "EDITOR",
  "ADMIN",
  "SUPER_ADMIN",
] as const satisfies readonly UserRole[];

export function isStaffRole(role: UserRole): boolean {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

/** AUTH-07: member session window in seconds (30 days, fixed from login). */
export const MEMBER_SESSION_SECONDS = 30 * 24 * 60 * 60;

/** AUTH-07: staff session window in seconds (8 hours, fixed from login). */
export const STAFF_SESSION_SECONDS = 8 * 60 * 60;

export function sessionDurationForRole(role: UserRole): number {
  return isStaffRole(role) ? STAFF_SESSION_SECONDS : MEMBER_SESSION_SECONDS;
}
