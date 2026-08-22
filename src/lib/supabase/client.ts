import { createBrowserClient } from "@supabase/ssr";

/**
 * BINZI browser Supabase client (TASK 009, Blueprint §3/§11).
 *
 * Official @supabase/ssr pattern: a factory that Client Components
 * call to obtain a browser client bound to the anon key.
 *
 * Boundary rules (Architecture Specification §29):
 * - Uses ONLY the NEXT_PUBLIC_* variables, read via process.env
 *   directly — never the server-only `@/lib/env` module, which would
 *   fail the build when imported from client code.
 * - Never references SUPABASE_SERVICE_ROLE_KEY or DATABASE_URL.
 * - Auth flows, server client, and middleware arrive in later tasks;
 *   this module only creates the client.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
