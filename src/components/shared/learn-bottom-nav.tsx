"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChartColumn, CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";
import { getActiveLearnNavItem, LEARN_NAV_ITEMS } from "./nav-items";

/*
 * Learn-area bottom navigation, < 768px only (card A-14b; screen 8e).
 * Renders only inside the (learn) layout; the fixed bar and the <main>
 * bottom padding that reserves space for it live in that layout.
 *
 * Three items — Materi · Quiz · Progress — with Lucide LINE icons (the
 * squares/circles in 8e are icon placeholders). Active = primary-deep on
 * icon + label with aria-current; idle = text-muted. Exact-match active
 * states come from getActiveLearnNavItem (nav-items.ts), where the
 * temporary destinations are documented ("sementara — final di S2, D-07").
 */

const ICONS = {
  materi: BookOpen,
  quiz: CircleHelp,
  progress: ChartColumn,
} as const;

export function LearnBottomNav() {
  const pathname = usePathname();
  const active = getActiveLearnNavItem(pathname);

  return (
    <nav
      aria-label="Navigasi belajar"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-border-soft bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {LEARN_NAV_ITEMS.map((item) => {
        const isActive = active?.key === item.key;
        const Icon = ICONS[item.key];
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex h-[62px] flex-col items-center justify-center gap-1 text-[11px] font-bold transition-colors duration-200 ease-out",
              isActive ? "text-primary-deep" : "text-text-muted hover:text-text",
            )}
          >
            <Icon aria-hidden="true" className="size-5" strokeWidth={1.8} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
