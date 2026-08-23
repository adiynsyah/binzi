import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * BINZI server-side authorization (TASK 014, Blueprint §12,
 * Business Rules §6/§7, Decisions Log #8).
 *
 * The ADMIN decision reads `public.users.role` — the authoritative
 * application record — through the single server-side database
 * client. The role is NEVER accepted from cookies, headers, query
 * parameters, request bodies, or UI state (Business Rules §31).
 *
 * `public.users.id` equals `auth.users.id` (Business Rules §6),
 * so the Supabase-authenticated user id is the lookup key.
 *
 * Missing application rows resolve to "not admin" — authorization
 * fails closed.
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const rows = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return rows[0]?.role === "ADMIN";
}
