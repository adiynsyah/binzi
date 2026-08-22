"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import {
  registerSchema,
  type RegisterField,
  type RegisterFieldErrors,
  type RegisterState,
} from "../schemas/register.schema";

/**
 * BINZI registration server action (TASK 011, Business Rules §6/§31).
 *
 * Flow: validate with Zod at the boundary → sign up through
 * Supabase Auth (server client, anon key) → provision the
 * application `users` record so `public.users.id` equals
 * `auth.users.id` (the "signup synchronization" promised by the
 * acceptance criteria).
 *
 * Boundary rules:
 * - `role` is never accepted from the client; the database default
 *   (USER) applies. Same for the user id (Business Rules §31).
 * - `display_name` is derived from the email local part because the
 *   registration form intentionally has no profile fields (UI/UX §31).
 * - When Supabase email confirmation is enabled, `signUp` returns a
 *   user without a session; the app record is still created and the
 *   UI asks the user to confirm. The `identities.length === 0`
 *   dummy response (email already registered) is reported without
 *   creating a phantom row.
 */
export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const errors: RegisterFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as RegisterField | undefined;
      if (field && !errors[field]) {
        errors[field] = issue.message;
      }
    }
    return { status: "error", errors };
  }

  const { email, password } = parsed.data;
  const emailNormalized = email.trim().toLowerCase();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: emailNormalized,
    password,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("already registered") ||
      message.includes("already been registered")
    ) {
      return {
        status: "error",
        message: "Email sudah terdaftar. Silakan masuk.",
      };
    }
    return { status: "error", message: error.message };
  }

  if (!data.user) {
    return {
      status: "error",
      message: "Pendaftaran gagal. Silakan coba lagi.",
    };
  }

  // Anti-enumeration dummy response: Supabase returns a fake user
  // (no identities) when the email is already registered and email
  // confirmation is enabled. Never provision a row for it.
  if ((data.user.identities?.length ?? 1) === 0) {
    return {
      status: "error",
      message: "Email sudah terdaftar. Silakan masuk.",
    };
  }

  const displayName = emailNormalized.split("@")[0];

  try {
    await db
      .insert(users)
      .values({
        id: data.user.id,
        email: emailNormalized,
        displayName,
        // role: server-side database default (USER) — never client input.
      })
      .onConflictDoNothing({ target: users.id });
  } catch {
    return {
      status: "error",
      message: "Pendaftaran gagal. Silakan coba lagi.",
    };
  }

  if (data.session) {
    return {
      status: "success",
      message:
        "Pendaftaran berhasil. Anda sudah masuk dan dapat mulai belajar.",
    };
  }

  return {
    status: "success",
    message:
      "Pendaftaran berhasil. Silakan periksa email Anda untuk mengonfirmasi akun.",
  };
}
