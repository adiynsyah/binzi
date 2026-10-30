"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Banner } from "@/components/ui/banner";
import { useSignOut } from "@/components/shared/use-sign-out";
import { CMS_ICONS } from "./cms-icons";
import {
  getActiveCmsItem,
  roleLabel,
  type CmsMenuGroup,
  type CmsUser,
} from "./cms-nav";

/*
 * CMS phone shell, < 640px (card A-15 step 7; screen 19e right): a 68-tall
 * top bar plus a drawer built exactly like the A-14a guest mobile menu on
 * the A-06 Radix dialog primitives — Radix supplies the scrim, the focus
 * trap, Esc / scrim-tap dismissal, the body scroll lock, and focus return
 * to the ☰ trigger (which it also keeps aria-expanded + aria-controls on).
 * The cover row puts ✕ in the ☰ slot because the trigger cannot be tapped
 * while the modal is open.
 *
 * The drawer closes after any item is clicked and when the viewport grows
 * to ≥ 640px. The ✕ cover row is PINNED (flex-none) and only the nav +
 * user block scroll INSIDE the panel (A-14b account-drawer pattern), so ✕
 * and the scrim stay reachable on a 360×640 screen even at the bottom.
 * Keluar uses useSignOut; on failure the drawer stays open and shows the
 * generic Banner notice.
 */

type CmsMobileBarProps = {
  groups: CmsMenuGroup[];
  user: CmsUser;
};

/** One drawer row: min 48 tall (card), CMS active state, 15px label. */
function drawerRowClass(isActive: boolean): string {
  return cn(
    "flex min-h-12 items-center gap-2.5 rounded-control pl-3 pr-3 text-[15px] font-bold transition-colors duration-200 ease-out",
    isActive ? "bg-text text-surface" : "text-text-nav hover:bg-fill",
  );
}

export function CmsMobileBar({ groups, user }: CmsMobileBarProps) {
  const [open, setOpen] = useState(false);
  const { pending, error, signOut } = useSignOut();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = getActiveCmsItem(
    pathname,
    searchParams.get("status"),
    user.role,
  );
  const label = roleLabel(user.role);

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
  // Locks every row while Keluar is in flight.
  const lock = pending ? "pointer-events-none" : undefined;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      {/* Top bar — 68 tall; the avatar is decorative (card), Keluar lives
          in the drawer. The bar sits INSIDE the Root so its ☰ is a proper
          DialogTrigger (aria-expanded/aria-controls come from Radix). */}
      <div className="flex h-[68px] flex-none items-center gap-3 border-b border-border-soft bg-surface px-4 sm:hidden">
        <DialogPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label="Buka menu CMS"
            className="grid size-11 place-items-center rounded-control border border-border text-text transition-colors duration-200 ease-out hover:border-border-strong hover:bg-fill"
          >
            <Menu aria-hidden="true" className="size-[22px]" strokeWidth={1.8} />
          </button>
        </DialogPrimitive.Trigger>
        <Link href="/cms" onClick={close} className="flex items-center gap-2">
          <Image
            src="/brand/logo-binzi-wordmark.png"
            alt="BINZI"
            width={1705}
            height={360}
            priority
            className="block h-5 w-auto"
          />
          <span className="rounded-[5px] border border-border px-[7px] py-[3px] font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-text-subtle">
            CMS
          </span>
        </Link>
        <Avatar
          name={user.name}
          size="sm"
          aria-hidden="true"
          className="ml-auto size-[34px] bg-text text-surface text-[12px]"
        />
      </div>

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
              Menu CMS
            </DialogPrimitive.Title>

            {/* Cover row — ✕ in the ☰ slot + wordmark + CMS chip; pinned
                (flex-none) so it never scrolls out of view. */}
            <div className="flex h-[68px] flex-none items-center gap-3 border-b border-border-soft px-4">
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  aria-label="Tutup menu CMS"
                  className="grid size-11 place-items-center rounded-control border border-border text-text transition-colors duration-200 ease-out hover:border-border-strong hover:bg-fill"
                >
                  <X
                    aria-hidden="true"
                    className="size-[22px]"
                    strokeWidth={1.8}
                  />
                </button>
              </DialogPrimitive.Close>
              <Image
                src="/brand/logo-binzi-wordmark.png"
                alt="BINZI"
                width={1705}
                height={360}
                priority
                className="block h-5 w-auto"
              />
              <span className="rounded-[5px] border border-border px-[7px] py-[3px] font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-text-subtle">
                CMS
              </span>
            </div>

            {/* Scrollable panel — everything except the cover row; caps at
                viewport − 68 so ✕ and the scrim below stay reachable. */}
            <div
              className="flex-1 overscroll-contain overflow-y-auto"
              style={{ maxHeight: "calc(100dvh - 68px)" }}
            >
            {/* Same groups & items as the sidebar; rows min 48 tall. */}
            <nav aria-label="Menu CMS" className="flex flex-col p-4">
              {groups.map((group) => (
                <div key={group.id}>
                  {group.label ? (
                    <div className="px-3 pb-1.5 pt-4 font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-text-meta">
                      {group.label}
                    </div>
                  ) : null}
                  {group.items.map((item) => {
                    const Icon = CMS_ICONS[item.icon];
                    const isActive = active?.id === item.id;
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={close}
                        aria-current={isActive ? "page" : undefined}
                        aria-disabled={pending || undefined}
                        className={cn(drawerRowClass(isActive), lock)}
                      >
                        <Icon
                          aria-hidden="true"
                          className="size-[18px] shrink-0"
                          strokeWidth={1.8}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>

            {/* Divider → user card → Lihat situs / Keluar. */}
            <div className="border-t border-border-soft p-4">
              <div className="flex items-center gap-3 rounded-card border border-border bg-surface-2 p-4">
                <Avatar
                  name={user.name}
                  size="sm"
                  aria-hidden="true"
                  className="size-9 shrink-0 bg-text text-surface text-[13px]"
                />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold leading-snug text-text">
                    {user.name}
                  </p>
                  {label ? (
                    <p
                      className={cn(
                        "mt-0.5 truncate text-[10.5px] font-bold",
                        user.role === "EDITOR"
                          ? "text-cycle-tint-text"
                          : "text-text-muted",
                      )}
                    >
                      {label}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-3.5 flex flex-col gap-0.5">
                <Link
                  href="/"
                  onClick={close}
                  aria-disabled={pending || undefined}
                  className={cn(drawerRowClass(false), lock)}
                >
                  Lihat situs
                </Link>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  disabled={pending}
                  className={cn(
                    drawerRowClass(false),
                    lock,
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
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
