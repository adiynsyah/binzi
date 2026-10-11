"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils";
import { getActiveNavItem, NAV_ITEMS } from "./nav-items";

/*
 * Text nav for the guest header (card A-14a), 640px and up. Client only
 * because the active item needs usePathname; the page itself stays static.
 *
 * Per-breakpoint composition (PRD §7.1, screens 1a/1t):
 * - ≥1024: all five items, "Tentang Kami" in full;
 * - 640–1023: Beranda hidden (the logo is the way home — 1t) and the
 *   compact "Tentang" label, both done with responsive classes so a single
 *   list serves both widths.
 *
 * Active item: aria-current="page" + 2px primary underline (1a). Konsultasi
 * never lights up (§7.1) — getActiveNavItem cannot return it.
 */
export function MainNav() {
  const pathname = usePathname();
  const active = getActiveNavItem(pathname);

  return (
    <nav
      aria-label="Utama"
      className="ml-8 hidden items-center gap-[26px] sm:flex"
    >
      {NAV_ITEMS.map((item) => {
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
