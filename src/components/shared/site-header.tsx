import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "../../lib/utils";
import { buttonVariants } from "../ui/button-variants";
import { MainNav } from "./main-nav";
import { MobileMenu } from "./mobile-menu";
import { HEADER_HEIGHT_CLASS, PUBLIC_HREFS } from "./nav-items";

/*
 * Guest header (card A-14a) — sticky, surface background, border-soft rule,
 * content capped at 1200 with 16/28/40 page padding. A SERVER component:
 * only MainNav (active state) and MobileMenu (dialog state) are client, so
 * no public page is made dynamic (PRD §10.4 — ISR must survive). The member
 * variant arrives in A-14b via a client-side session.
 *
 * Per-breakpoint composition:
 * - ≥1024 (1a): logo · Beranda…Tentang Kami · Cari · Masuk (ghost) ·
 *   Daftar Gratis (primary);
 * - 640–1023 (1t): logo · Kursus…Tentang · Cari · Masuk (dark) — Beranda
 *   and Daftar Gratis do not fit at 640, the logo leads home;
 * - <640 (1d): ☰ · centered logo · Cari.
 *
 * Header action buttons sit at the 44px touch minimum (--height-touch-min),
 * matching the 1a mock — cn() resolves them against the variant default.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border-soft bg-surface">
      <div
        className={cn(
          "mx-auto flex max-w-content items-center px-4 sm:px-7 lg:px-10",
          HEADER_HEIGHT_CLASS,
        )}
      >
        <MobileMenu />
        <Link
          href={PUBLIC_HREFS.home}
          className="absolute left-1/2 -translate-x-1/2 sm:static sm:translate-x-0"
        >
          <Image
            src="/brand/logo-binzi-wordmark.png"
            alt="BINZI"
            width={1705}
            height={360}
            priority
            className="block h-5 w-auto"
          />
        </Link>
        <MainNav />
        <div className="ml-auto flex items-center gap-3">
          <Link
            href={PUBLIC_HREFS.cari}
            aria-label="Cari"
            className="grid size-11 place-items-center rounded-control border border-border bg-surface text-text transition-colors duration-200 ease-out hover:border-border-strong hover:bg-fill"
          >
            <Search
              aria-hidden="true"
              className="size-[17px]"
              strokeWidth={1.8}
            />
          </Link>
          {/* Masuk: ghost at ≥1024 (1a), dark at 640–1023 (1t), inside the
              mobile menu below 640 (PRD §7.1). */}
          <Link
            href={PUBLIC_HREFS.masuk}
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "hidden min-h-11 px-4 text-[15px] lg:inline-flex",
            )}
          >
            Masuk
          </Link>
          <Link
            href={PUBLIC_HREFS.masuk}
            className={cn(
              buttonVariants({ variant: "dark" }),
              "hidden min-h-11 px-4 text-[15px] sm:inline-flex lg:hidden",
            )}
          >
            Masuk
          </Link>
          <Link
            href={PUBLIC_HREFS.daftar}
            className={cn(
              buttonVariants({ variant: "primary" }),
              "hidden min-h-11 px-5 text-[15px] lg:inline-flex",
            )}
          >
            Daftar Gratis
          </Link>
        </div>
      </div>
    </header>
  );
}
