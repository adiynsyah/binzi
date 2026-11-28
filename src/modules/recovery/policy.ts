// Role policy for the recovery module (card S3-03 §2). The service applies
// the role guard FIRST, then parses input (guard order,
// src/modules/README.md). Ownership lives in queries.ts (`user_id = actor`
// in the participant WHEREs — anti-IDOR in two layers).
import { ForbiddenError } from "@/lib/errors";
import { roleAtLeast, type SessionUser } from "@/lib/rbac";

/** MEMBER+ for the participant report flow. */
export function assertMemberRole(actor: SessionUser): void {
  if (!roleAtLeast(actor.role, "MEMBER")) {
    throw new ForbiddenError("Aksi ini memerlukan peran member");
  }
}

/** ADMIN+ for the queue, the review, and every reset (CMS-10). */
export function assertAdminRole(actor: SessionUser): void {
  if (!roleAtLeast(actor.role, "ADMIN")) {
    throw new ForbiddenError("Aksi ini memerlukan peran admin");
  }
}

/** Hours after created_at the participant is promised a decision
 *  (decision 9: 24 calendar hours, not working hours). */
export const REPORT_DEADLINE_HOURS = 24;

/** The deadline turns red when fewer than this many hours remain. */
export const REPORT_URGENT_HOURS = 6;
