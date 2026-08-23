import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isUserAdmin } from "@/lib/auth/authorization";

/**
 * BINZI auth proxy (TASK 013/014, Blueprint §12 "Auth Middleware /
 * Protection").
 *
 * Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`
 * (same request-lifecycle position: runs before routes render,
 * Node.js runtime). This file is the Blueprint's auth middleware.
 *
 * Responsibilities:
 * - TASK 013 — user-facing protected paths (`/profile`,
 *   `/courses/<slug>/learn/*`): guests are redirected to /login
 *   (Business Rules §5), authenticated users pass.
 * - TASK 014 — `/admin/*`: guests are redirected to /login;
 *   authenticated users must hold the ADMIN application role in
 *   `public.users` (checked server-side via lib/auth/authorization)
 *   or receive HTTP 403. Authenticated non-admins are NOT sent to
 *   /login — they are signed in, just forbidden.
 * - Refresh auth cookies by writing token updates to the response,
 *   closing the read-only-cookies gap of Server Components noted
 *   in lib/supabase/server.ts.
 *
 * Still NOT handled here (per Blueprint §12 "Middleware is not the
 * only security boundary"): business authorization (enrollment,
 * lesson access, quiz access) — that belongs to the service layer
 * in later milestones, reusing the same authorization helper.
 *
 * Environment: `process.env.NEXT_PUBLIC_*` is read directly per
 * the official @supabase/ssr middleware pattern — this runs in
 * the proxy runtime with build-time-inlined public values, not in
 * a Server Component (so @/lib/env is not used here). The ADMIN
 * role lookup uses the server-side database client, whose
 * DATABASE_URL is resolved at runtime in the proxy's Node.js
 * environment.
 */

/** User-facing protected paths (Blueprint §12). */
const PROTECTED_EXACT_PATHS = new Set(["/profile", "/admin"]);

const PROTECTED_LEARNING_PATTERN = /^\/courses\/[^/]+\/learn(?:\/.*)?$/;

const ADMIN_PATH_PATTERN = /^\/admin(?:\/.*)?$/;

function isProtectedPath(pathname: string): boolean {
  return (
    PROTECTED_EXACT_PATHS.has(pathname) ||
    PROTECTED_LEARNING_PATTERN.test(pathname)
  );
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PATH_PATTERN.test(pathname);
}

/** Minimal inline 403 body — admin pages arrive with TASK 015+. */
function forbiddenResponse(): NextResponse {
  return new NextResponse(
    "<!DOCTYPE html><html lang=\"id\"><head><meta charset=\"utf-8\">" +
      "<title>403 — Akses Ditolak</title></head>" +
      "<body><h1>403 — Akses Ditolak</h1>" +
      "<p>Anda tidak memiliki izin untuk mengakses halaman ini.</p>" +
      "</body></html>",
    {
      status: 403,
      headers: { "content-type": "text/html; charset=utf-8" },
    },
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

  const pathname = request.nextUrl.pathname;
  const adminPath = isAdminPath(pathname);

  if (!user && (isProtectedPath(pathname) || adminPath)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && adminPath) {
    // Authorization: the ADMIN role comes only from the
    // authoritative `public.users` record. Any failure (missing
    // application row, database error) denies access — the check
    // fails closed.
    let isAdmin = false;
    try {
      isAdmin = await isUserAdmin(user.id);
    } catch {
      isAdmin = false;
    }
    if (!isAdmin) {
      return forbiddenResponse();
    }
  }

  return response;
}

export const config = {
  // Pre-filter: run only on the protected path shapes. The
  // authoritative guards are isProtectedPath()/isAdminPath() above.
  matcher: [
    "/profile",
    "/admin",
    "/admin/:path*",
    "/courses/:path*/learn",
    "/courses/:path*/learn/:path*",
  ],
};
