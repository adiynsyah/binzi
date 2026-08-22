import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/lib/env";

/**
 * BINZI server Supabase client (TASK 010, Blueprint §3/§11).
 *
 * Official @supabase/ssr pattern for App Router: create a fresh
 * client per request, bound to the anon key, reading and writing the
 * Supabase auth cookies via `cookies()` from `next/headers`.
 *
 * Boundary rules:
 * - Uses ONLY the public Supabase URL + anon key (validated through
 *   the server-only `@/lib/env` module). The service-role key is never
 *   used for user authentication.
 * - Guarded by `import "server-only"`: any accidental import from a
 *   Client Component fails the build.
 * - Cookie writes from Server Components are not allowed by Next.js;
 *   the catch below follows the official pattern. Session refresh via
 *   middleware belongs to the route-protection tasks (TASK 013/014).
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = getPublicEnv();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component where cookies are
            // read-only; auth middleware (later task) refreshes sessions.
          }
        },
      },
    },
  );
}
