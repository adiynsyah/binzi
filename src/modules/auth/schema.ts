// Input contracts for authentication (card A-09).
//
// Pure Zod, no server imports: the A-13 sign-in/sign-up forms import these
// schemas for client-side validation so both sides enforce the exact same
// rules (AUTH-01). `src/components/ui/password-rules.ts` should switch to
// importing `passwordSchema`/`PASSWORD_MIN_LENGTH` from here (A-13).
import { z } from "zod";

/** AUTH-01: minimum password length. Mirrors Better Auth `minPasswordLength`. */
export const PASSWORD_MIN_LENGTH = 8;

/** AUTH-01: min 8 characters, at least one letter and one digit. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, {
    message: `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter`,
  })
  .regex(/[A-Za-z]/, { message: "Kata sandi harus mengandung huruf" })
  .regex(/[0-9]/, { message: "Kata sandi harus mengandung angka" });

/** Normalizes an email for bucket keys and lookups (no validation). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const signInSchema = z.object({
  email: z.email({ message: "Format email tidak valid" }),
  password: z.string().min(1, { message: "Kata sandi wajib diisi" }),
});

export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Nama wajib diisi" })
    .max(128, { message: "Nama maksimal 128 karakter" }),
  email: z.email({ message: "Format email tidak valid" }),
  password: passwordSchema,
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
