import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * BINZI auth proxy (TASK 013, Blueprint §12 "Auth Middleware /
 * Protection").
 *
 * Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`
 * (same request-lifecycle position: runs before routes render,
 * Node.js runtime). This file is the Blueprint's auth middleware.
 *
 * Responsibilities (TASK 013 scope — user-facing protected paths):
 * - Validate the Supabase session on protected paths and redirect
 *   guests to /login (Business Rules §5: guests may not access the
 *   protected learning experience).
 * - Refresh auth cookies by writing token updates to the response,
 *   closing the read-only-cookies gap of Server Components noted
 *   in lib/supabase/server.ts.
 *
 * Deliberately NOT handled here (per Blueprint §12 "Middleware is
 * not the only security boundary" and the task plan):
 * - /admin/* protection and ADMIN role checks → TASK 014.
 * - Business authorization (enrollment, lesson access, quiz
 *   access) → service layer in later milestones.
 *
 * Environment: `process.env.NEXT_PUBLIC_*` is read directly per
 * the official @supabase/ssr middleware pattern — this runs in
 * the proxy runtime with build-time-inlined public values, not in
 * a Server Component (so @/lib/env is not used here).
 */

/** User-facing protected paths (Blueprint §12; /admin/* is TASK 014). */
const PROTECTED_EXACT_PATHS = new Set(["/profile"]);

const PROTECTED_LEARNING_PATTERN = /^\/courses\/[^/]+\/learn(?:\/.*)?$/;

function isProtectedPath(pathname: string): boolean {
  return (
    PROTECTED_EXACT_PATHS.has(pathname) ||
    PROTECTED_LEARNING_PATTERN.test(pathname)
  );
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write refreshed tokens onto the request for downstream
          // server rendering and onto the response so they persist.
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // getUser() validates the session server-side against Supabase
  // Auth (never trust cookies alone) and refreshes tokens via
  // setAll when needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Pre-filter: run only on the protected path shapes. The
  // authoritative guard is isProtectedPath() above.
  matcher: [
    "/profile",
    "/courses/:path*/learn",
    "/courses/:path*/learn/:path*",
  ],
};
