import { PublicHeader } from "@/components/layout/PublicHeader/PublicHeader";
import { createClient } from "@/lib/supabase/server";

import styles from "./layout.module.scss";

/**
 * BINZI public website shell (TASK 036, UI/UX §3 "Global Navigation",
 * Task Plan Milestone 7).
 *
 * Route group `(public)` — the group adds NO URL segment, so the pages
 * inside keep their canonical paths (`/` today; `/courses`, `/articles`
 * arrive with TASK 038/040). The shell renders exactly the TASK 036
 * navigation (Logo, Courses, Articles, Login/Profile) per UI/UX §3:
 * anonymous visitors get "Masuk" → /login, authenticated visitors get
 * "Profil" → /profile (a Blueprint §12 protected path — src/proxy.ts
 * already owns its protection). The session is read server-side via
 * the validated Supabase SSR session (never client input), which makes
 * everything under this shell render per-request — the honest cost of
 * an auth-aware header (route count is unchanged).
 *
 * Deliberate boundaries:
 * - The admin CMS keeps its own TASK 015 shell; nothing admin is (or
 *   can be) leaked here — this header renders no role-conditional
 *   entries at all.
 * - This is a shell only: no homepage sections (TASK 037), no
 *   catalog/detail/article content (TASK 038–041), no footer (no spec
 *   section defines one; FLAG-5 in the TASK 036 audit).
 * - "(auth)" pages (/login, /register) stay standalone per UI/UX §30
 *   and keep their pre-existing TASK 011/012 behavior.
 */
export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <a className={styles.skipLink} href="#main-content">
        Lewati ke konten utama
      </a>
      <PublicHeader isAuthenticated={!!user} />
      <main className={styles.main} id="main-content">
        {children}
      </main>
    </>
  );
}
