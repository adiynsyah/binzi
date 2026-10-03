// The ONLY public door of the user module (A-08). Routes, server actions,
// and other modules import functions — and DTO types via `import type` —
// from here; never queries.ts (ESLint-enforced), serializer.ts, or policy.ts.
//
// Canonical guard order (see src/modules/README.md):
// - Role-gated endpoints (e.g. listUsers): check the role FIRST, then parse
//   input — unauthorized callers must not learn the input contract.
// - Ownership-based endpoints: parse input first (the target id is needed),
//   then the ownership policy, then the query.
// Raw rows never cross this boundary; every return value is a JSON-safe DTO.
import { NotFoundError } from "../../lib/errors";
import { PAGE_SIZE } from "../../lib/pagination";

import type { Actor } from "./policy";
import { assertMinRole, assertSelf, assertSelfOrAdmin } from "./policy";
import * as userQueries from "./queries";
import { getUserInput, listUsersInput, updateProfileInput } from "./schema";
import type { PublicUserDTO, UserPrivateDTO } from "./serializer";
import { toPublicUserDTO, toUserPrivateDTO } from "./serializer";

// DTO types for consumers: import these from service, not from serializer.
export type { PublicUserDTO, UserPrivateDTO };

/** Owner's own profile, or any profile for ADMIN+. Everyone else gets 404. */
export async function getUserProfile(
  actor: Actor,
  input: unknown,
): Promise<UserPrivateDTO> {
  const { userId } = getUserInput.parse(input);
  assertSelfOrAdmin(actor, userId);

  const row = await userQueries.findUserById(userId);
  if (!row) throw new NotFoundError("Pengguna tidak ditemukan");
  return toUserPrivateDTO(row);
}

/** Owner-only profile edit (name/phone). Admin editing others is out of
 *  scope here and belongs to a future admin-management card. */
export async function updateUserProfile(
  actor: Actor,
  input: unknown,
): Promise<UserPrivateDTO> {
  const parsed = updateProfileInput.parse(input);
  assertSelf(actor, parsed.userId);

  const row = await userQueries.updateUserProfile(parsed.userId, {
    name: parsed.name,
    phone: parsed.phone,
  });
  if (!row) throw new NotFoundError("Pengguna tidak ditemukan");
  return toUserPrivateDTO(row);
}

export type UserListDTO = {
  users: UserPrivateDTO[];
  page: number;
  pageSize: number;
  totalUsers: number;
  totalPages: number;
};

/** CMS user management — ADMIN+. Role is checked BEFORE input parsing:
 *  the endpoint's existence is not a secret, but its input contract is not
 *  for unauthorized eyes. Insufficient roles get 403. */
export async function listUsers(
  actor: Actor,
  input: unknown,
): Promise<UserListDTO> {
  assertMinRole(actor, "ADMIN");
  const { page } = listUsersInput.parse(input);

  const { rows, total } = await userQueries.listUsers(page);
  return {
    users: rows.map(toUserPrivateDTO),
    page,
    pageSize: PAGE_SIZE,
    totalUsers: total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Public byline/reviewer data — no actor required. The EDITOR+ role gate
 *  lives in the query's WHERE clause (PUBLIC_PROFILE_ROLES), so non-public
 *  users are simply not found (404). Other modules (e.g. article) consume
 *  this via service.ts. */
export async function getPublicUserProfile(
  input: unknown,
): Promise<PublicUserDTO> {
  const { userId } = getUserInput.parse(input);

  const row = await userQueries.findPublicUserById(userId);
  if (!row) throw new NotFoundError("Pengguna tidak ditemukan");
  return toPublicUserDTO(row);
}
