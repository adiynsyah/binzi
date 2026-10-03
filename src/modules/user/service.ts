// The ONLY public door of the user module (A-08). Routes, server actions,
// and other modules import functions from here — never queries.ts or
// serializer.ts directly (ESLint-enforced for queries).
//
// Flow per call: validate input (Zod, throws ZodError → 400) → enforce
// policy (404 ownership / 403 role) → query → serialize to a DTO.
// Raw rows never cross this boundary.
import { NotFoundError } from "../../lib/errors";
import { PAGE_SIZE } from "../../lib/pagination";

import type { Actor } from "./policy";
import { assertMinRole, assertSelf, assertSelfOrAdmin } from "./policy";
import * as userQueries from "./queries";
import { getUserInput, listUsersInput, updateProfileInput } from "./schema";
import type { PublicUserDTO, UserPrivateDTO } from "./serializer";
import { toPublicUserDTO, toUserPrivateDTO } from "./serializer";

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

/** CMS user management — ADMIN+. Insufficient roles get 403, not 404: the
 *  endpoint's existence is not a secret, only the right is missing. */
export async function listUsers(actor: Actor, input: unknown): Promise<UserListDTO> {
  const { page } = listUsersInput.parse(input);
  assertMinRole(actor, "ADMIN");

  const { rows, total } = await userQueries.listUsers(page);
  return {
    users: rows.map(toUserPrivateDTO),
    page,
    pageSize: PAGE_SIZE,
    totalUsers: total,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Public byline/reviewer data — no actor required, exposes id/name/image
 *  only. Other modules (e.g. article) consume this via service.ts. */
export async function getPublicUserProfile(
  input: unknown,
): Promise<PublicUserDTO> {
  const { userId } = getUserInput.parse(input);

  const row = await userQueries.findUserById(userId);
  if (!row) throw new NotFoundError("Pengguna tidak ditemukan");
  return toPublicUserDTO(row);
}
