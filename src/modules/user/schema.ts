// Zod input contracts for the user module (A-08).
//
// This file MAY be imported from outside the module — including client
// forms: it is the shared input contract. Keep it pure Zod with no server
// imports (no "server-only", no db) so it stays safe in a client bundle.
//
// strictObject everywhere: payloads carrying keys the contract does not know
// (role, status, email, ...) are rejected instead of silently stripped.
import { z } from "zod";

export const getUserInput = z.strictObject({
  userId: z.string().min(1, "ID pengguna wajib diisi"),
});

// Name rules shared by every profile-name contract below (card S5-05 §4.1):
// trim + required + 128 max, with the signup messages.
const nameField = z
  .string()
  .trim()
  .min(1, "Nama wajib diisi")
  .max(128, "Nama maksimal 128 karakter");

// Profile fields the owner may change. Deliberately WITHOUT image (avatar
// goes through the media/R2 flow in a later sprint) and without any
// privileged field (role/status/email are server-managed).
export const updateProfileInput = z.strictObject({
  userId: z.string().min(1, "ID pengguna wajib diisi"),
  name: nameField,
  // Optional: omit to keep the current value, null to clear it.
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{8,15}$/, "Nomor telepon tidak valid")
    .nullish(),
});

// The /profil name form's contract (card S5-05): name ONLY. There is no
// userId to choose — the route writes to the SESSION user's id — so any
// other key (userId, phone, role, email, image) is rejected, never
// silently stripped.
export const updateNameInput = z.strictObject({
  name: nameField,
});

// Page size is fixed by the server (src/lib/pagination.ts) — clients may
// never request a bigger one.
export const listUsersInput = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
});

export type GetUserInput = z.infer<typeof getUserInput>;
export type UpdateProfileInput = z.infer<typeof updateProfileInput>;
export type UpdateNameInput = z.infer<typeof updateNameInput>;
export type ListUsersInput = z.infer<typeof listUsersInput>;
