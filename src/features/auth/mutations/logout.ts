"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * BINZI logout server action (TASK 012).
 *
 * Signs out through Supabase Auth with the server client; the
 * client removes the session cookies (writable from a Server
 * Action). Redirects to /login afterwards.
 */
export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
