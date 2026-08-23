"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./AdminNav.module.scss";

/**
 * BINZI CMS navigation (TASK 015, CMS Spec §3, Decisions Log #9).
 *
 * Items follow the TASK 015 task plan: Dashboard, Courses, Contents,
 * Questions (the plan's four entries; the "Media" entry mentioned in
 * CMS Spec §3 / Decisions Log #9 is not part of TASK 015's scope).
 *
 * This component is presentation only — it renders links and marks
 * the current section. Route-level ADMIN protection is owned by
 * src/proxy.ts (TASK 014); no authorization happens here.
 */
const NAV_ITEMS: ReadonlyArray<{
  href: string;
  label: string;
  /** Exact match instead of section-prefix match (used by /admin). */
  exact?: boolean;
}> = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/courses", label: "Kursus" },
  { href: "/admin/contents", label: "Konten" },
  { href: "/admin/questions", label: "Bank Soal" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Admin">
      <ul className={styles.list}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={isActive ? styles.linkActive : styles.link}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
