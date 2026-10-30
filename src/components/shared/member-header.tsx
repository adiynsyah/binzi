"use client";

import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { MainNav } from "./main-nav";
import { AccountDrawer, AccountDropdown } from "./account-menu";
import type { MemberUser } from "./member-user";
import {
  getActiveMemberNavItem,
  HEADER_HEIGHT_CLASS,
  MEMBER_NAV_ITEMS,
  PUBLIC_HREFS,
} from "./nav-items";
import { PageContainer } from "./page-container";

/*
 * Member header (card A-14b) — the A-14a skeleton with the guest chrome
 * swapped for member chrome. Sticky, surface, border-soft rule, content
 * capped at 1200 with 16/28/40 page padding, and the SAME per-breakpoint
 * height constants (HEADER_HEIGHT_CLASS) so S6's scroll-margin-top keeps
 * one source of truth.
 *
 * Per-breakpoint composition (PRD §7.1; screens 13a / 8t / 13d+8e):
 * - ≥ 1024 (13a): logo · Belajar…Tentang Kami · Cari · account pill
 *   (name, ellipsized + avatar + caret);
 * - 640–1023 (8t): logo · Belajar…Tentang · Cari · avatar only;
 * - < 640 (13d/8e): logo left · avatar right. No ☰ and no Cari button —
 *   the main nav and Cari live inside the account drawer.
 *
 * A client component in both shells: (public) mounts it after the session
 * resolves; (learn) receives { name, email } from its server layout, so
 * the member header never flashes there.
 */
export function MemberHeader({ user }: { user: MemberUser }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border-soft bg-surface">
      <PageContainer className={cn("flex items-center", HEADER_HEIGHT_CLASS)}>
        {/* < 640 the logo leads from the LEFT (13d) — no centered wordmark,
            no hamburger; the drawer covers navigation. */}
        <Link href={PUBLIC_HREFS.home}>
          <Image
            src="/brand/logo-binzi-wordmark.png"
            alt="BINZI"
            width={1705}
            height={360}
            priority
            className="block h-5 w-auto"
          />
        </Link>
        <MainNav items={MEMBER_NAV_ITEMS} getActive={getActiveMemberNavItem} />
        <div className="ml-auto flex items-center gap-3">
          {/* Cari stays in the header from 640 up; below that it is a row
              inside the account drawer. */}
          <Link
            href={PUBLIC_HREFS.cari}
            aria-label="Cari"
            className="hidden size-11 place-items-center rounded-control border border-border bg-surface text-text transition-colors duration-200 ease-out hover:border-border-strong hover:bg-fill sm:grid"
          >
            <Search
              aria-hidden="true"
              className="size-[17px]"
              strokeWidth={1.8}
            />
          </Link>
          {/* < 640: avatar opens the account drawer (dialog). */}
          <AccountDrawer user={user} />
          {/* ≥ 640: one dropdown, two trigger shapes (8t avatar, 13a pill). */}
          <AccountDropdown user={user} />
        </div>
      </PageContainer>
    </header>
  );
}
