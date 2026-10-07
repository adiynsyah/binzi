// Server-side authorization: route matrix + session guards (card A-12,
// PRD §3.2 & §12.1, security checklist V-04).
//
// LAYERED GUARD RULE (product-owner decision): the (learn)/(cms) layouts
// call these helpers, but that is only the OUTERMOST layer. Every page,
// route handler, and sensitive server action must call requireUser /
// requireRole (pages & actions) or requireApiUser / requireApiRole (API)
// itself — hiding a button is never authorization (§12.1).
//
// Response contract (product-owner decision):
// - Page, not signed in → redirect to /masuk?next=<path+query>. The `next`
//   value is ONLY ever a path that passed safeInternalRedirectPath; it is
//   built from a proxy-set header (src/proxy.ts) that clients can forge,
//   so a missing or invalid header redirects WITHOUT `next`.
// - API, not signed in → 401 JSON (UnauthorizedError), never a redirect.
// - Role too low → 403: pages via forbidden() (src/app/forbidden.tsx),
//   API via ForbiddenError → toErrorResponse (A-08 pattern). The role is
//   checked BEFORE any input parsing (guard order, src/modules/README.md).
//
// Session truth (product-owner decision): role & status are read from the
// DATABASE on every request — auth.api.getSession with disableCookieCache
// (no cookieCache is configured today; the flag keeps this guarantee if
// that ever changes). A status other than ACTIVE (SUSPENDED/DELETED) is
// treated exactly like "not signed in" — fail closed. GUEST is the absence
// of a session, not a DB value.
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { z } from "zod";

import { userRoleEnum, userStatusEnum } from "../db/schema";
import { safeInternalRedirectPath } from "../modules/auth/schema";
import { ForbiddenError, UnauthorizedError } from "./errors";

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type UserStatus = (typeof userStatusEnum.enumValues)[number];

/** All roles, lowest first — handy for tests and the A-15 CMS menu. */
export const ALL_ROLES: readonly UserRole[] = userRoleEnum.enumValues;

// MEMBER < EDITOR < ADMIN < SUPER_ADMIN — cumulative (PRD §3.2). Kept in
// sync with ROLE_RANK in src/modules/user/policy.ts; module policy files
// are module-internal (src/modules/README.md), so lib keeps its own map.
const ROLE_RANK: Record<UserRole, number> = {
  MEMBER: 1,
  EDITOR: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

export function roleAtLeast(role: UserRole, min: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export type RouteRule = {
  /** Route pattern, no trailing slash. */
  readonly path: string;
  /** "exact" matches the path itself; "prefix" also matches sub-paths. */
  readonly match: "exact" | "prefix";
  /** Minimum role (roles are cumulative). */
  readonly minRole: UserRole;
};

/**
 * THE route-protection matrix (PRD §3.2 + §7.2) — single source of truth
 * for these guards AND the role-filtered CMS menu in A-15. FIRST MATCH
 * WINS, so specific rules must come before the fail-closed /cms catch-all
 * at the bottom.
 */
export const ROUTE_RULES: readonly RouteRule[] = [
  // MEMBER+ (§7.2 "MEMBER")
  { path: "/belajar", match: "prefix", minRole: "MEMBER" },
  { path: "/profil", match: "exact", minRole: "MEMBER" },
  // EDITOR+ (CMS workbench)
  { path: "/cms", match: "exact", minRole: "EDITOR" },
  { path: "/cms/konten", match: "exact", minRole: "EDITOR" },
  { path: "/cms/artikel", match: "exact", minRole: "EDITOR" },
  { path: "/cms/kursus", match: "prefix", minRole: "EDITOR" },
  { path: "/cms/media", match: "exact", minRole: "EDITOR" },
  // ADMIN+
  { path: "/cms/kategori", match: "exact", minRole: "ADMIN" },
  { path: "/cms/pengguna", match: "exact", minRole: "ADMIN" },
  { path: "/cms/reset-attempt", match: "exact", minRole: "ADMIN" },
  // SUPER_ADMIN only
  { path: "/cms/pengaturan", match: "exact", minRole: "SUPER_ADMIN" },
  { path: "/cms/audit-log", match: "exact", minRole: "SUPER_ADMIN" },
  // Fail-closed catch-all (product-owner decision): a /cms sub-path NOT
  // listed above — a route that does not exist yet, or should not exist —
  // requires SUPER_ADMIN instead of inheriting the EDITOR area minimum.
  { path: "/cms", match: "prefix", minRole: "SUPER_ADMIN" },
];

/**
 * Minimum role for a page path, or null when the path is public (§7.2
 * "PUBLIK" — everything outside /belajar, /profil, and /cms).
 */
export function minRoleForPath(pathname: string): UserRole | null {
  for (const rule of ROUTE_RULES) {
    if (rule.match === "exact") {
      if (pathname === rule.path) return rule.minRole;
    } else if (
      pathname === rule.path ||
      pathname.startsWith(`${rule.path}/`)
    ) {
      return rule.minRole;
    }
  }
  return null;
}

/** Minimal authenticated identity for authorization decisions. */
export type SessionUser = {
  id: string;
  role: UserRole;
  status: UserStatus;
};

/**
 * GUEST = null session (no DB value). A non-ACTIVE user never appears
 * here: toSessionUser already collapses SUSPENDED/DELETED to null, so
 * every consumer fails closed. Public paths (no matrix row) allow anyone.
 */
export function pathAllows(user: SessionUser | null, pathname: string): boolean {
  const min = minRoleForPath(pathname);
  if (min === null) return true;
  return user !== null && roleAtLeast(user.role, min);
}

// Unknown role/status shapes (e.g. a future enum value the running code
// does not know) must fail closed, so the session user is validated with
// the actual DB enums before any decision is made.
const sessionUserSchema = z.object({
  id: z.string().min(1),
  role: z.enum(userRoleEnum.enumValues),
  status: z.enum(userStatusEnum.enumValues),
});

/**
 * Better Auth `getSession` result → SessionUser. Returns null for: no
 * session, an unexpected user shape, or any status other than ACTIVE
 * (SUSPENDED/DELETED are "not signed in" — product-owner decision).
 * Exported for integration tests that run a real Better Auth instance.
 */
export function toSessionUser(
  session: { user?: unknown } | null,
): SessionUser | null {
  if (!session) return null;
  const parsed = sessionUserSchema.safeParse(session.user);
  if (!parsed.success) return null;
  const user = parsed.data;
  return user.status === "ACTIVE" ? user : null;
}

/** Reads the authoritative session (DB per request) from request headers. */
export type SessionReader = (requestHeaders: Headers) => Promise<SessionUser | null>;

async function defaultReadSession(
  requestHeaders: Headers,
): Promise<SessionUser | null> {
  // Lazy on purpose: getAuth() pulls validated env + the DB client, neither
  // of which exists under vitest or `next build` (see src/lib/auth.ts).
  const { getAuth } = await import("./auth");
  const auth = await getAuth();
  const session = await auth.api.getSession({
    headers: requestHeaders,
    // Role & status must come from the DB, never a cookie cache
    // (product-owner decision; no cookieCache is configured today).
    query: { disableCookieCache: true },
  });
  return toSessionUser(session);
}

// Proxy → server communication (src/proxy.ts; kept as separate constants
// there so the edge bundle never loads these server guards). The values
// are CLIENT-FORGEABLE and are treated as untrusted input below.
const PATHNAME_HEADER = "x-binzi-pathname";
const SEARCH_HEADER = "x-binzi-search";

/**
 * /masuk target for an unauthenticated page request. The inputs are the
 * (forgeable) proxy headers: only a value that survives
 * safeInternalRedirectPath becomes `next` — anything else drops it.
 */
export function loginRedirectPath(
  pathnameHeader: string | null,
  searchHeader: string | null,
): string {
  const candidate = `${pathnameHeader ?? ""}${searchHeader ?? ""}`;
  const next = safeInternalRedirectPath(candidate);
  return next === null ? "/masuk" : `/masuk?next=${encodeURIComponent(next)}`;
}

/**
 * Page / server-action guard: any signed-in ACTIVE user. Not signed in →
 * redirect to /masuk (with `next` only when the proxy headers survive
 * validation). redirect() throws, so the return value is always a user.
 */
export async function requireUser(
  readSession: SessionReader = defaultReadSession,
): Promise<SessionUser> {
  const requestHeaders = await headers();
  const user = await readSession(requestHeaders);
  if (user) return user;
  redirect(
    loginRedirectPath(
      requestHeaders.get(PATHNAME_HEADER),
      requestHeaders.get(SEARCH_HEADER),
    ),
  );
}

/**
 * Page / server-action guard with a minimum role. Not signed in → redirect
 * /masuk; role too low → forbidden() renders the 403 page
 * (src/app/forbidden.tsx).
 */
export async function requireRole(
  min: UserRole,
  readSession: SessionReader = defaultReadSession,
): Promise<SessionUser> {
  const user = await requireUser(readSession);
  if (!roleAtLeast(user.role, min)) forbidden();
  return user;
}

/**
 * API guard: any signed-in ACTIVE user. Not signed in (or SUSPENDED/
 * DELETED) → UnauthorizedError → 401 JSON via toErrorResponse — an API
 * never redirects (product-owner decision).
 */
export async function requireApiUser(
  request: Request,
  readSession: SessionReader = defaultReadSession,
): Promise<SessionUser> {
  const user = await readSession(request.headers);
  if (!user) throw new UnauthorizedError();
  return user;
}

/**
 * API guard with a minimum role. 401 before 403: an unidentified caller
 * is never told which role an endpoint needs. Call this BEFORE parsing
 * request input (guard order, src/modules/README.md).
 */
export async function requireApiRole(
  min: UserRole,
  request: Request,
  readSession: SessionReader = defaultReadSession,
): Promise<SessionUser> {
  const user = await requireApiUser(request, readSession);
  if (!roleAtLeast(user.role, min)) {
    const readable = min.replaceAll("_", " ").toLowerCase();
    throw new ForbiddenError(`Aksi ini memerlukan peran ${readable}`);
  }
  return user;
}
