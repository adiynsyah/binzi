"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import {
  loginSchema,
  type LoginField,
  type LoginFieldErrors,
  type LoginState,
} from "../schemas/login.schema";

/**
 * BINZI login server action (TASK 012, Blueprint §"Server":
 * Supabase SSR client → authenticated session → application
 * user — no second authentication system).
 *
 * Signs in through Supabase Auth with the server client, so the
 * session cookies are written from the Server Action (where
 * cookies are writable). Route protection is TASK 013; this
 * action only establishes the session and redirects home.
 */
export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const errors: LoginFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as LoginField | undefined;
      if (field && !errors[field]) {
        errors[field] = issue.message;
      }
    }
    return { status: "error", errors };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("invalid login credentials")) {
      return {
        status: "error",
        message: "Email atau kata sandi salah.",
      };
    }
    return { status: "error", message: error.message };
  }

  // Session cookies are set; send the user home. Learning routes
  // and their protection arrive with TASK 013+.
  redirect("/");
}
