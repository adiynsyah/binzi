import { z } from "zod";

/**
 * BINZI login validation (TASK 012, UI/UX §30).
 *
 * The login form collects exactly Email and Password. The password
 * is validated as required only — account passwords are owned by
 * Supabase Auth, so login must not re-impose registration-length
 * rules on existing accounts.
 */
export const loginSchema = z.object({
  email: z.email("Alamat email tidak valid."),
  password: z.string().min(1, "Kata sandi wajib diisi."),
});

export type LoginInput = z.infer<typeof loginSchema>;

export type LoginField = "email" | "password";

export type LoginFieldErrors = Partial<Record<LoginField, string>>;

/**
 * State returned by the login server action and consumed by the
 * form via `useActionState`. Successful logins never produce a
 * success state — the action redirects instead.
 */
export type LoginState =
  | { status: "idle" }
  | {
      status: "error";
      /** Per-field validation messages. */
      errors?: LoginFieldErrors;
      /** Form-level message (e.g. invalid credentials). */
      message?: string;
    };

export const initialLoginState: LoginState = { status: "idle" };
