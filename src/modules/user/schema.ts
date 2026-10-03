// Zod input contracts for the user module (A-08).
// Services validate every input with these on the server; client forms may
// reuse the same schemas for immediate feedback.
//
// strictObject everywhere: payloads carrying keys the contract does not know
// (role, status, email, ...) are rejected instead of silently stripped.
import { z } from "zod";

export const getUserInput = z.strictObject({
  userId: z.string().min(1, "ID pengguna wajib diisi"),
});

// Profile fields the owner may change. Deliberately WITHOUT image (avatar
// goes through the media/R2 flow in a later sprint) and without any
// privileged field (role/status/email are server-managed).
export const updateProfileInput = z.strictObject({
  userId: z.string().min(1, "ID pengguna wajib diisi"),
  name: z
    .string()
    .trim()
    .min(1, "Nama wajib diisi")
    .max(100, "Nama maksimal 100 karakter"),
  // Optional: omit to keep the current value, null to clear it.
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{8,15}$/, "Nomor telepon tidak valid")
    .nullish(),
});

// Page size is fixed by the server (src/lib/pagination.ts) — clients may
// never request a bigger one.
export const listUsersInput = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
});

export type GetUserInput = z.infer<typeof getUserInput>;
export type UpdateProfileInput = z.infer<typeof updateProfileInput>;
export type ListUsersInput = z.infer<typeof listUsersInput>;
