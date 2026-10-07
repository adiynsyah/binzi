// CLI: npm run user:role -- <email> <ROLE>  (card A-12)
//
// Manually assigns a role — the product owner's way to make an account
// EDITOR/ADMIN/SUPER_ADMIN. There is deliberately NO web endpoint for
// this; the script is run by hand only.
//
// - The email is normalized (trim + lowercase) before lookup.
// - The role update AND the revocation of every session happen in ONE
//   transaction. Session windows are fixed at sign-in (30 days / 8 hours,
//   card A-09), and an existing session keeps carrying its old role — so
//   revoking forces the next sign-in to happen under the new role.
// - NO audit_logs row is written: actor_id is NOT NULL and a CLI run has
//   no actor. Stated explicitly in the A-12 PR summary (owner decision).
//
// Environment: loaded by the npm script via
// `tsx --env-file-if-exists=.env --env-file-if-exists=.env.local`
// (later files win, so .env.local overrides .env; shell env wins over
// files — same precedence as elsewhere in the repo). The script itself
// only ever reads DATABASE_URL from process.env, never the env files.
// Note: --env-file-if-exists requires Node >= 22.9.
import { eq } from "drizzle-orm";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createDb, type Db } from "../src/db/client";
import { sessions, userRoleEnum, users } from "../src/db/schema";
import { normalizeEmail } from "../src/modules/auth/schema";

/** Every role the CLI may assign (excludes GUEST — not a DB value). */
export const ASSIGNABLE_ROLES = userRoleEnum.enumValues;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export type SetRoleResult = {
  userId: string;
  email: string;
  oldRole: AssignableRole;
  newRole: AssignableRole;
  revokedSessions: number;
};

/**
 * Validate input, then update the role and revoke all sessions in one
 * transaction. Exported for the A-12 integration tests (PGlite).
 * Throws Error with a user-facing Indonesian message on bad input.
 */
export async function setUserRole(
  db: Db,
  emailInput: string,
  roleInput: string,
): Promise<SetRoleResult> {
  const email = normalizeEmail(emailInput);
  if (!email) {
    throw new Error("Email wajib diisi");
  }
  const newRole = ASSIGNABLE_ROLES.find((role) => role === roleInput);
  if (!newRole) {
    throw new Error(
      `Role tidak valid: "${roleInput}". Pilihan: ${ASSIGNABLE_ROLES.join(", ")}.`,
    );
  }

  return db.transaction(async (tx) => {
    const found = await tx
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    const user = found[0];
    if (!user) {
      throw new Error(`User dengan email ${email} tidak ditemukan`);
    }

    await tx.update(users).set({ role: newRole }).where(eq(users.id, user.id));
    const revoked = await tx
      .delete(sessions)
      .where(eq(sessions.userId, user.id))
      .returning({ id: sessions.id });

    return {
      userId: user.id,
      email,
      oldRole: user.role,
      newRole,
      revokedSessions: revoked.length,
    };
  });
}

function printUsage(): void {
  console.error("Pemakaian: npm run user:role -- <email> <ROLE>");
  console.error(`ROLE salah satu dari: ${ASSIGNABLE_ROLES.join(", ")}`);
}

async function main(): Promise<void> {
  const [, , emailArg, roleArg, ...extra] = process.argv;
  if (!emailArg || !roleArg || extra.length > 0) {
    printUsage();
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "DATABASE_URL belum diisi — muat lewat .env.local / .env (lihat docs/tasks/README.md).",
    );
    process.exit(1);
  }

  // Existing factory: Supabase transaction-pooler settings preserved
  // (postgres-js with prepare:false, src/db/client.ts).
  const { db, client } = createDb(url);
  try {
    const result = await setUserRole(db, emailArg, roleArg);
    console.log(
      `${result.email}: role ${result.oldRole} → ${result.newRole}; sesi dicabut: ${result.revokedSessions}`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

// Run only when executed as a script (tsx), not when tests import the
// setUserRole core.
const entry = process.argv[1];
const invokedAsScript =
  entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href;
if (invokedAsScript) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
