"use client";

import { authClient } from "./auth/auth-client";
import { MemberHeader } from "./member-header";
import { SiteHeader } from "./site-header";

/*
 * Session-aware header gate for the (public) shell (card A-14b).
 *
 * The session is read CLIENT-side from the existing Better Auth client —
 * never on the server — so public pages keep their static/ISR output
 * (PRD §10.4). While the session is loading, and for guests, the A-14a
 * guest header renders exactly as before: the static HTML of / always
 * carries Masuk & Daftar Gratis and the first client render matches it
 * (no hydration mismatch, deliberately no placeholder/skeleton). A signed
 * in member sees the header swap to the member variant once the session
 * resolves — the brief flash is accepted (12 Oct revision).
 *
 * The member header receives only { name, email }; the Avatar derives the
 * initial itself (member-user.ts owns the email fallback).
 */
export function SessionHeader() {
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;

  if (!isPending && user?.email) {
    return (
      <MemberHeader user={{ name: user.name ?? "", email: user.email }} />
    );
  }
  return <SiteHeader />;
}
