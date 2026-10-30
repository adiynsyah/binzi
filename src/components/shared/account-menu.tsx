"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Banner } from "@/components/ui/banner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ACCOUNT_MENU_ITEMS,
  getActiveAccountItem,
  getActiveMemberNavItem,
  HEADER_HEIGHT,
  HEADER_HEIGHT_CLASS,
  NAV_ITEMS,
  PUBLIC_HREFS,
} from "./nav-items";
import { displayNameOf, type MemberUser } from "./member-user";
import { useSignOut } from "./use-sign-out";

/*
 * The member account menu (card A-14b) in two shapes that mirror the guest
 * A-14a pattern:
 * - AccountDropdown, ≥ 640px (13a): the existing Dropdown/Menu primitive —
 *   a 268-wide panel, right-aligned under the account button. ONE trigger
 *   renders both shapes responsively: the avatar-only button at 640–1023
 *   (8t) and the name pill at ≥ 1024 (13a).
 * - AccountDrawer, < 640px (13d-1): a full-width panel dropping straight
 *   below the header, built on the A-06 Radix dialog primitives exactly
 *   like the A-14a guest mobile menu (no hand-rolled focus trap). Its own
 *   cover row carries logo + ✕ in the avatar slot, because the trigger
 *   cannot be tapped while the modal is open and phones have no Esc.
 *
 * Active rows in BOTH shapes come from the shared active-item functions in
 * nav-items.ts — no path comparison lives here. Idle and active rows share
 * weight 700 (Lato has no 600, so 13d itself renders both at 700); the
 * active marker is the fill-soft background + aria-current, with the A-14a
 * mobile-menu colors (active `text`, idle `text-muted`) kept for
 * consistency between the guest and member drawers.
 *
 * Keluar: authClient.signOut() → router.replace("/") + refresh (useSignOut).
 * While in flight every item locks; on failure the menu STAYS open (the
 * dropdown prevents its select-close) and shows the generic Banner notice
 * from auth-errors.ts.
 */

type AccountMenuProps = { user: MemberUser };

export function AccountDropdown({ user }: AccountMenuProps) {
  const { pending, error, signOut } = useSignOut();
  const pathname = usePathname();
  const active = getActiveAccountItem(pathname);
  const displayName = displayNameOf(user);

  return (
    <DropdownMenu>
      {/* ONE trigger for both shapes. A Radix DropdownMenu owns a single
          anchor (triggerRef); a second trigger overwrites it, so the pill
          (display:none below 1024) became the anchor with a 0×0 rect at
          (0,0) — parking the panel at the viewport's top-left and dumping
          close-focus on a hidden element. The button is responsive instead:
          avatar-only at 640–1023 (8t), the pill at ≥ 1024 (13a). Radix
          labels it aria-haspopup="menu" and manages aria-expanded; the
          avatar and caret are decorative inside this labelled button. */}
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Menu akun"
          className={cn(
            "group hidden h-11 w-11 place-items-center rounded-pill text-text",
            "transition-colors duration-200 ease-out hover:bg-fill",
            "sm:grid lg:inline-flex lg:w-auto lg:items-center lg:gap-2.5",
            "lg:border lg:border-border lg:pl-3 lg:pr-1.5",
            "lg:hover:border-border-strong lg:hover:bg-transparent",
          )}
        >
          <span className="hidden max-w-[22ch] truncate text-[13.5px] font-bold text-text-muted lg:block">
            {displayName}
          </span>
          <Avatar
            name={displayName}
            size="sm"
            aria-hidden="true"
            className="size-9 bg-text text-surface text-[14px] lg:size-8 lg:text-[13px]"
          />
          <ChevronDown
            aria-hidden="true"
            className="hidden size-3.5 text-text-meta transition-transform duration-200 ease-out group-data-[state=open]:rotate-180 lg:block"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[268px] rounded-card border-border-strong p-2"
      >
        {/* Head: avatar 40 + name + email (13a canvas spec). */}
        <div className="flex items-center gap-3 px-2 pb-2 pt-1.5">
          <Avatar
            name={displayName}
            size="sm"
            aria-hidden="true"
            className="size-10 shrink-0 bg-text text-surface text-[15px]"
          />
          <div className="min-w-0">
            <p className="truncate text-[14.5px] font-bold leading-snug text-text">
              {displayName}
            </p>
            <p className="mt-0.5 truncate font-mono text-[11.5px] font-medium text-text-meta">
              {user.email}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator className="mb-1" />

        {ACCOUNT_MENU_ITEMS.map((item) => {
          const isActive = active?.key === item.key;
          return (
            <DropdownMenuItem key={item.key} asChild disabled={pending}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "text-[14.5px] data-[highlighted]:bg-fill-soft",
                  isActive && "bg-fill-soft",
                )}
              >
                {item.label}
              </Link>
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator className="mb-1" />

        {/* preventDefault keeps the dropdown open so the failure banner is
            reachable; success navigates away and unmounts it anyway. */}
        <DropdownMenuItem
          disabled={pending}
          onSelect={(event) => {
            event.preventDefault();
            void signOut();
          }}
          className="text-danger data-[highlighted]:bg-danger-tint data-[highlighted]:text-danger"
        >
          Keluar
        </DropdownMenuItem>

        {error ? <Banner tone="error" title={error} className="mt-2" /> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/*
 * Drawer main nav (13d, card): the guest items minus Beranda — Dashboard
 * above already represents the learn area — plus Cari, which has no header
 * button below 640.
 */
const DRAWER_NAV_ROWS: readonly {
  key: string;
  href: string;
  label: string;
  withHint?: boolean;
}[] = [
  ...NAV_ITEMS.filter(
    (item) =>
      item.key === "kursus" ||
      item.key === "artikel" ||
      item.key === "konsultasi" ||
      item.key === "tentang",
  ).map((item) => ({
    key: item.key,
    href: item.href,
    label: item.label,
    withHint: item.key === "konsultasi",
  })),
  { key: "cari", href: PUBLIC_HREFS.cari, label: "Cari" },
];

/** One 13d row: min 52 tall, side padding 14, radius 10, 16px text. */
function drawerRowClass(isActive: boolean): string {
  return cn(
    "flex min-h-[52px] items-center rounded-control px-3.5 text-[16px] font-bold transition-colors duration-200 ease-out",
    isActive ? "bg-fill-soft text-text" : "text-text-muted hover:bg-fill",
  );
}

export function AccountDrawer({ user }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const { pending, error, signOut } = useSignOut();
  const pathname = usePathname();
  const activeAccount = getActiveAccountItem(pathname);
  const activeNav = getActiveMemberNavItem(pathname);
  const displayName = displayNameOf(user);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const closeWhenDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setOpen(false);
      }
    };
    mq.addEventListener("change", closeWhenDesktop);
    return () => mq.removeEventListener("change", closeWhenDesktop);
  }, []);

  const close = () => setOpen(false);
  // Locks every row while Keluar is in flight (card: "item terkunci").
  const lock = pending ? "pointer-events-none" : undefined;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="Menu akun"
          className="grid size-11 place-items-center rounded-pill text-text transition-colors duration-200 ease-out hover:bg-fill sm:hidden"
        >
          <Avatar
            name={displayName}
            size="sm"
            aria-hidden="true"
            className="size-9 bg-text text-surface text-[14px]"
          />
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-40 bg-scrim",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            "duration-200 ease-out",
          )}
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-x-0 top-0 z-50 flex max-h-dvh flex-col bg-surface",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            "duration-200 ease-out",
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            Menu akun
          </DialogPrimitive.Title>

          {/* Cover row — replaces the < 640 header bar: logo left, ✕ in
              the avatar slot (same 44px touch target as the guest menu). */}
          <div
            className={cn(
              "flex flex-none items-center border-b border-border-soft px-4",
              HEADER_HEIGHT_CLASS,
            )}
          >
            <Link href={PUBLIC_HREFS.home} onClick={close}>
              <Image
                src="/brand/logo-binzi-wordmark.png"
                alt="BINZI"
                width={1705}
                height={360}
                priority
                className="block h-5 w-auto"
              />
            </Link>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                aria-label="Tutup menu akun"
                className="ml-auto grid size-11 place-items-center rounded-control text-text transition-colors duration-200 ease-out hover:bg-fill"
              >
                <X
                  aria-hidden="true"
                  className="size-[22px]"
                  strokeWidth={1.8}
                />
              </button>
            </DialogPrimitive.Close>
          </div>

          {/* Panel — taller than a 360×640 screen, so it caps at viewport
              − header and scrolls INSIDE; Keluar stays reachable (card). */}
          <div
            className="flex-1 overscroll-contain overflow-y-auto p-4"
            style={{
              maxHeight: `calc(100dvh - ${HEADER_HEIGHT.mobile}px)`,
            }}
          >
            {/* 1. Name card (13d-1). */}
            <div className="flex items-center gap-3 rounded-card border border-border bg-surface-2 p-4">
              <Avatar
                name={displayName}
                size="md"
                aria-hidden="true"
                className="size-12 shrink-0 bg-text text-surface text-[18px]"
              />
              <div className="min-w-0">
                <p className="truncate text-[17px] font-black leading-tight text-text">
                  {displayName}
                </p>
                <p className="mt-1 truncate font-mono text-[11.5px] font-medium text-text-meta">
                  {user.email}
                </p>
              </div>
            </div>

            {/* 2. Account items. */}
            <div className="mt-3.5 flex flex-col gap-0.5">
              {ACCOUNT_MENU_ITEMS.map((item) => {
                const isActive = activeAccount?.key === item.key;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={close}
                    aria-current={isActive ? "page" : undefined}
                    aria-disabled={pending || undefined}
                    className={cn(drawerRowClass(isActive), lock)}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* 3. Main nav — same row style; Belajar is not repeated
                (Dashboard above represents it). */}
            <div className="mt-3.5 border-t border-border-soft pt-3.5">
              <nav aria-label="Utama" className="flex flex-col gap-0.5">
                {DRAWER_NAV_ROWS.map((item) => {
                  const isActive = activeNav?.key === item.key;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={close}
                      aria-current={isActive ? "page" : undefined}
                      aria-disabled={pending || undefined}
                      className={cn(
                        drawerRowClass(isActive),
                        lock,
                        item.withHint && "flex-col items-start justify-center",
                      )}
                    >
                      {item.label}
                      {/* Explicit space keeps the accessible name readable
                          ("Konsultasi di beranda"; the arrow is
                          aria-hidden) — A-14a pattern. */}
                      {" "}
                      {item.withHint ? (
                        <span className="mt-0.5 font-mono text-[11px] font-medium text-text-subtle">
                          di beranda <span aria-hidden="true">↓</span>
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* 4. Keluar. */}
            <div className="mt-3.5 border-t border-border-soft pt-3.5">
              <button
                type="button"
                onClick={() => void signOut()}
                disabled={pending}
                className={cn(
                  drawerRowClass(false),
                  "w-full text-danger hover:bg-danger-tint disabled:pointer-events-none disabled:text-text-subtle disabled:hover:bg-transparent",
                )}
              >
                Keluar
              </button>
            </div>

            {error ? (
              <Banner tone="error" title={error} className="mt-3" />
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
