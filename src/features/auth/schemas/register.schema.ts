import { z } from "zod";

/**
 * BINZI registration validation (TASK 011, UI/UX §31, Blueprint §14).
 *
 * The registration form collects exactly Email, Password, and
 * Confirm Password — no profile fields ("Do not put unnecessary
 * profile fields into registration").
 *
 * Password minimum is 8 characters: the specs do not fix a number,
 * so BINZI enforces a length stricter than the Supabase default
 * (6), matching the copy demonstrated in the approved UI
 * primitives ("Kata sandi minimal 8 karakter."). The server action
 * is the authority; native attributes on the form are only a
 * first gate.
 */
export const registerSchema = z
  .object({
    email: z.email("Alamat email tidak valid."),
    password: z
      .string()
      .min(8, "Kata sandi minimal 8 karakter.")
      .max(72, "Kata sandi maksimal 72 karakter."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Konfirmasi kata sandi tidak cocok.",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export type RegisterField =
  | "email"
  | "password"
  | "confirmPassword";

export type RegisterFieldErrors = Partial<
  Record<RegisterField, string>
>;

/**
 * State returned by the register server action and consumed by the
 * form via `useActionState`.
 */
export type RegisterState =
  | { status: "idle" }
  | {
      status: "error";
      /** Per-field validation messages. */
      errors?: RegisterFieldErrors;
      /** Form-level message (e.g. Supabase Auth failure). */
      message?: string;
    }
  | { status: "success"; message: string };

export const initialRegisterState: RegisterState = { status: "idle" };
