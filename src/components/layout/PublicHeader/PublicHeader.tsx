"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";

import styles from "./PublicHeader.module.scss";

/**
 * BINZI public global header (TASK 036, UI/UX §3 "Global Navigation").
 *
 * Exactly the Task Plan 036 navigation set — Logo (wordmark → /),
 * Kursus (/courses), Artikel (/articles), and the auth-aware entry:
 * "Masuk" → /login for guests, "Profil" → /profile once signed in
 * (UI/UX §3 after-login state). The authenticated flag is computed
 * SERVER-side from the validated Supabase session by the (public)
 * layout and passed down — this component never inspects cookies or
 * trusts client input for the session state.
 *
 * Destinations for later-milestone routes follow the approved route
 * structure (Blueprint §12; UI/UX §6/§28): /courses lands with TASK
 * 038, /articles with TASK 040, the /profile page later still — the
 * links are honest links, and src/proxy.ts already protects /profile
 * for guests (TASK 013). No admin entries exist here by design.
 *
 * Mobile follows UI/UX §3's "Logo + Menu" pattern: a labelled toggle
 * button (never icon-only, §34) with aria-expanded/aria-controls; the
 * same list renders inline from the "medium" breakpoint up. Active
 * section marking mirrors AdminNav (aria-current + pathname match).
 */
const NAV_ITEMS: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/courses", label: "Kursus" },
  { href: "/articles", label: "Artikel" },
];

export function PublicHeader({ isAuthenticated }: { isAuthenticated: boolean }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const authHref = isAuthenticated ? "/profile" : "/login";
  const authLabel = isAuthenticated ? "Profil" : "Masuk";

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link
          aria-label="BINZI — Beranda"
          className={styles.brand}
          href="/"
          onClick={() => setMenuOpen(false)}
        >
          BINZI
        </Link>

        <button
          aria-controls="public-navigation"
          aria-expanded={menuOpen}
          className={styles.menuToggle}
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          Menu
        </button>

        <nav
          aria-label="Utama"
          className={menuOpen ? styles.navOpen : styles.nav}
          id="public-navigation"
        >
          <ul className={styles.list}>
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`);

              return (
                <li key={item.href}>
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={isActive ? styles.linkActive : styles.link}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <Link
                className={styles.authLink}
                href={authHref}
                onClick={() => setMenuOpen(false)}
              >
                {authLabel}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
