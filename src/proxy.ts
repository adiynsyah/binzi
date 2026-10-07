// Edge guard for signed-in areas (card A-12; Next.js 16 renamed
// middleware to proxy — see node_modules/next/dist/docs, "Proxy").
//
// OPTIMISTIC CHECK ONLY (product-owner decision): cookie presence, no DB
// access, no role logic. The authoritative checks live server-side in
// src/lib/rbac.ts (layout, page, route handler, server action). This file
// never touches /api/** (kept out by the matcher): API endpoints answer
// 401/403 JSON themselves and must not be redirected here.
//
// Signed-in requests are forwarded with x-binzi-pathname / x-binzi-search
// SET — overwriting any client-supplied value, never appending — so
// requireUser() can build /masuk?next=… . Those headers remain untrusted
// input there: without the proxy, or with a forged value,
// safeInternalRedirectPath rejects them and the redirect simply drops
// `next`. The constants are duplicated in src/lib/rbac.ts on purpose: a
// shared module would drag the server guards into the edge bundle.
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { safeInternalRedirectPath } from "./modules/auth/schema";

// Must stay identical to PATHNAME_HEADER / SEARCH_HEADER in src/lib/rbac.ts
// (proxy.test.ts asserts the strings through the forwarded headers).
const PATHNAME_HEADER = "x-binzi-pathname";
const SEARCH_HEADER = "x-binzi-search";

export function proxy(request: NextRequest) {
  const forwarded = new Headers(request.headers);
  // Overwrite, never append: a client-sent x-binzi-pathname must not
  // survive into the app (product-owner decision).
  forwarded.set(PATHNAME_HEADER, request.nextUrl.pathname);
  forwarded.set(SEARCH_HEADER, request.nextUrl.search);

  // Cookie NAME and __Secure- prefix follow Better Auth
  // (better-auth/cookies checks both the prefixed and plain names).
  if (getSessionCookie(request)) {
    return NextResponse.next({ request: { headers: forwarded } });
  }

  const target = safeInternalRedirectPath(
    request.nextUrl.pathname + request.nextUrl.search,
  );
  const login =
    target === null
      ? new URL("/masuk", request.nextUrl.origin)
      : new URL(`/masuk?next=${encodeURIComponent(target)}`, request.nextUrl.origin);
  return NextResponse.redirect(login);
}

export const config = {
  // Signed-in areas only (product-owner decision). ":path*" also matches
  // the bare path. /api/** is deliberately absent.
  matcher: ["/belajar/:path*", "/profil", "/cms/:path*"],
};
