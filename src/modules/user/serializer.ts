// Explicit serialization for the user domain (PRD §12.6, V-01/V-05 note).
//
// Module-internal: consumers outside the module get DTO types re-exported
// from service.ts (`import type { PublicUserDTO } from "@/modules/user/service"`).
//
// Rules:
// - One DTO per audience — never a single "complete" DTO:
//     toPublicUserDTO  → unconstrained contexts (article byline, reviewer).
//     toUserPrivateDTO → the owner's own profile, or ADMIN+ views.
// - JSON-safe: dates are serialized to ISO 8601 strings (null stays null).
// - Both functions build a fresh object from an explicit allowlist, so any
//   column not listed (deletedAt, updatedAt, ...) can never leave the module
//   even if a future query starts selecting it.
//
// This file imports the db schema as types only and must stay free of any
// runtime db import, so serializer tests run without DATABASE_URL.
import type { users } from "../../db/schema";

/** Fields queries may fetch for serialization — deliberately excluding
 *  deletedAt/updatedAt, which never even reach the serializers. */
export type UserRow = Pick<
  typeof users.$inferSelect,
  | "id"
  | "name"
  | "email"
  | "emailVerified"
  | "image"
  | "phone"
  | "role"
  | "status"
  | "lastLoginAt"
  | "createdAt"
>;

/** Columns the public query selects — exactly what the public DTO needs. */
export type PublicUserRow = Pick<UserRow, "id" | "name" | "image">;

// DTOs are JSON-safe by rule: dates leave the module as ISO 8601 strings
// (null stays null), never as Date objects.
export type PublicUserDTO = {
  id: string;
  name: string;
  image: string | null;
};

export type UserPrivateDTO = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  phone: string | null;
  role: UserRow["role"];
  status: UserRow["status"];
  lastLoginAt: string | null;
  createdAt: string;
};

export function toPublicUserDTO(row: PublicUserRow): PublicUserDTO {
  return {
    id: row.id,
    name: row.name,
    image: row.image,
  };
}

export function toUserPrivateDTO(row: UserRow): UserPrivateDTO {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    image: row.image,
    phone: row.phone,
    role: row.role,
    status: row.status,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
