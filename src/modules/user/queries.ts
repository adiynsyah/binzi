// Database access for the user domain (A-08).
//
// NEVER import this from another module — go through service.ts. The
// no-restricted-imports rule in eslint.config.mjs enforces it, and
// src/lib/module-boundary.test.ts proves the rule fails offending imports.
//
// Every query selects an explicit column allowlist (never select *) and
// hides soft-deleted rows (deletedAt IS NULL — PRD §10.5 purge semantics).
import "server-only";

import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "../../db";
import { users } from "../../db/schema";
import { PAGE_SIZE, offsetForPage } from "../../lib/pagination";

import { PUBLIC_PROFILE_ROLES } from "./policy";
import type { PublicUserRow, UserRow } from "./serializer";

// The only columns this module ever reads. deletedAt/updatedAt are
// intentionally absent — they never even reach the serializers.
const userColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  emailVerified: users.emailVerified,
  image: users.image,
  phone: users.phone,
  role: users.role,
  status: users.status,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
};

const notDeleted = isNull(users.deletedAt);

export async function findUserById(
  userId: string,
): Promise<UserRow | undefined> {
  const rows = await db
    .select(userColumns)
    .from(users)
    .where(and(eq(users.id, userId), notDeleted))
    .limit(1);
  return rows[0];
}

/** Public byline lookup: EDITOR+ only, enforced in the WHERE clause (the
 *  role list comes from policy.ts) — non-public users are simply not found.
 *  Selects exactly the three columns the public DTO serializes. */
export async function findPublicUserById(
  userId: string,
): Promise<PublicUserRow | undefined> {
  const rows = await db
    .select({ id: users.id, name: users.name, image: users.image })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        notDeleted,
        inArray(users.role, [...PUBLIC_PROFILE_ROLES]),
      ),
    )
    .limit(1);
  return rows[0];
}

/** Update the owner-editable fields. Returns undefined when the user does
 *  not exist or is soft-deleted (the WHERE clause carries the check). */
export async function updateUserProfile(
  userId: string,
  patch: { name: string; phone?: string | null },
): Promise<UserRow | undefined> {
  const rows = await db
    .update(users)
    .set({
      name: patch.name,
      ...(patch.phone === undefined ? {} : { phone: patch.phone }),
    })
    .where(and(eq(users.id, userId), notDeleted))
    .returning(userColumns);
  return rows[0];
}

export async function listUsers(
  page: number,
): Promise<{ rows: UserRow[]; total: number }> {
  const [rows, totals] = await Promise.all([
    db
      .select(userColumns)
      .from(users)
      .where(notDeleted)
      // Newest first; id tiebreaker keeps the order stable across pages.
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(PAGE_SIZE)
      .offset(offsetForPage(page)),
    db.select({ value: count() }).from(users).where(notDeleted),
  ]);

  return { rows, total: totals[0]?.value ?? 0 };
}
