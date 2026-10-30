"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Menu, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  getActiveNavItem,
  HEADER_HEIGHT_CLASS,
  NAV_ITEMS,
  PUBLIC_HREFS,
} from "./nav-items";

/*
 * Guest mobile menu, < 640px only (card A-14a; screen 1d panel + modal
 * behavior). Built on the A-06 Radix dialog primitives — Radix supplies the
 * focus trap, Esc, the scrim click, the body scroll lock and focus return to
 * the ☰ trigger; no focus trap is hand-rolled here.
 *
 * Because a modal dialog swallows pointer events outside itself, the ☰
 * cannot be tapped while open. The content therefore starts with a cover row
 * (review adjustment) that exactly replaces the header bar: a ✕ in the ☰
 * slot (aria-label "Tutup menu"), the centered logo and the Cari button —
 * visually the ☰ turns into ✕. Below it sits the full-width 1d panel.
 *
 * The drawer closes itself after any item is clicked (KSL-13) and when the
 * viewport grows to ≥ 640px, where the hamburger no longer exists.
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const active = getActiveNavItem(pathname);

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

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="Buka menu"
          className="grid size-11 place-items-center rounded-control text-text transition-colors duration-200 ease-out hover:bg-fill sm:hidden"
        >
          <Menu aria-hidden="true" className="size-[22px]" strokeWidth={1.8} />
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
            "fixed inset-x-0 top-0 z-50 max-h-dvh overflow-y-auto bg-surface",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            "duration-200 ease-out",
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            Menu
          </DialogPrimitive.Title>

          {/* Cover row — mirrors the < 640 header bar it replaces. */}
          <div
            className={cn(
              "relative flex items-center border-b border-border-soft px-4",
              HEADER_HEIGHT_CLASS,
            )}
          >
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                aria-label="Tutup menu"
                className="grid size-11 place-items-center rounded-control text-text transition-colors duration-200 ease-out hover:bg-fill"
              >
                <X
                  aria-hidden="true"
                  className="size-[22px]"
                  strokeWidth={1.8}
                />
              </button>
            </DialogPrimitive.Close>
            <Link
              href={PUBLIC_HREFS.home}
              onClick={close}
              className="absolute left-1/2 -translate-x-1/2"
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
            <Link
              href={PUBLIC_HREFS.cari}
              onClick={close}
              aria-label="Cari"
              className="ml-auto grid size-11 place-items-center rounded-control border border-border text-text transition-colors duration-200 ease-out hover:border-border-strong hover:bg-fill"
            >
              <Search
                aria-hidden="true"
                className="size-[17px]"
                strokeWidth={1.8}
              />
            </Link>
          </div>

          {/* 1d panel: full-width rows, 48 tall, radius 8–10. The active
              row reuses getActiveNavItem — bold 700 in `text`, the rest in
              `text-muted`, mirroring the header nav. Masuk and Daftar
              Gratis are required by PRD §7.1 but not drawn in 1d —
              composed from tokens. */}
          <nav aria-label="Utama" className="flex flex-col gap-1 p-4">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={close}
                aria-current={active?.key === item.key ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-col justify-center rounded-control px-3 py-2 text-[15px] font-bold transition-colors duration-200 ease-out hover:bg-fill",
                  active?.key === item.key ? "text-text" : "text-text-muted",
                )}
              >
                {item.label}
                {/* Explicit space: keeps the accessible name readable
                    ("Konsultasi di beranda"; the arrow is aria-hidden) —
                    JSX drops whitespace-only lines between expressions. */}
                {" "}
                {item.key === "konsultasi" ? (
                  <span className="mt-0.5 font-mono text-[11px] font-medium text-text-subtle">
                    di beranda <span aria-hidden="true">↓</span>
                  </span>
                ) : null}
              </Link>
            ))}

            <div className="mt-4 flex flex-col gap-3 border-t border-border-soft pt-4">
              <Link
                href={PUBLIC_HREFS.masuk}
                onClick={close}
                className={cn(
                  buttonVariants({ variant: "secondary" }),
                  "w-full",
                )}
              >
                Masuk
              </Link>
              <Link
                href={PUBLIC_HREFS.daftar}
                onClick={close}
                className={cn(buttonVariants({ variant: "primary" }), "w-full")}
              >
                Daftar Gratis
              </Link>
            </div>
          </nav>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
