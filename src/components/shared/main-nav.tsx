"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";
import {
  getActiveNavItem,
  NAV_ITEMS,
  type NavItem,
} from "./nav-items";

/*
 * Text nav for the header, 640px and up (card A-14a; screens 1a/1t, member
 * variant 13a/8t in A-14b). Client only because the active item needs
 * usePathname; the page itself stays static.
 *
 * Per-breakpoint composition (PRD §7.1, screens 1a/1t):
 * - ≥1024: all five items, "Tentang Kami" in full;
 * - 640–1023: Beranda hidden (the logo is the way home — 1t) and the
 *   compact "Tentang" label, both done with responsive classes so a single
 *   list serves both widths. The member nav has no Beranda item at all
 *   (Belajar replaces it and stays visible at 640), so the same rule is a
 *   no-op there.
 *
 * Active item: aria-current="page" + 2px primary underline (1a). Konsultasi
 * never lights up (§7.1) — neither active-item function can return it.
 *
 * Guests render the defaults; the member header passes its own items and
 * active-item function — one presentation, two models.
 */
export type MainNavProps = {
  /** Nav model; defaults to the five guest items. */
  items?: readonly NavItem[];
  /** Active-item resolver; defaults to the guest one. */
  getActive?: (pathname: string) => NavItem | null;
};

export function MainNav({
  items = NAV_ITEMS,
  getActive = getActiveNavItem,
}: MainNavProps) {
  const pathname = usePathname();
  const active = getActive(pathname);

  return (
    <nav
      aria-label="Utama"
      className="ml-8 hidden items-center gap-[26px] sm:flex"
    >
      {items.map((item) => {
        const isActive = active?.key === item.key;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative py-1.5 text-[15px] font-bold transition-colors duration-200 ease-out",
              isActive
                ? "text-text after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary"
                : "text-text-muted hover:text-text",
              // 640–1023 hides Beranda (1t): the centered logo leads home.
              item.key === "beranda" && "hidden lg:block",
            )}
          >
            {item.shortLabel ? (
              <>
                <span className="lg:hidden">{item.shortLabel}</span>
                <span className="hidden lg:inline">{item.label}</span>
              </>
            ) : (
              item.label
            )}
          </Link>
        );
      })}
    </nav>
  );
}
