import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/*
 * PageContainer — the single source of the page content column (TOKENS.md
 * "Spasi"; PRD §1): content is capped at 1200 (`max-w-content`) and the
 * 16/28/40 page padding sits OUTSIDE that 1200. Target content edges:
 * 360 → 16…344 · 768 → 28…740 · 1024 → 40…984 · 1280 → 40…1240 ·
 * 1440 → 120…1320. Header underlines and the footer background stay
 * full-bleed — only the content is capped. Every (public) and (learn)
 * page, and everything S1+ builds, wraps its content in this component.
 *
 * Two elements on purpose: the outer div carries the page padding against
 * the viewport edges; the inner div is the capped column and receives the
 * caller's className (flex, height — e.g. HEADER_HEIGHT_CLASS — py-14…).
 * A single element with `box-content` would also add up, but it silently
 * switches height and width utilities to content-box sizing and would
 * break the shared header height the moment a py lands on the same
 * element.
 *
 * No "use client" and no server-only imports on purpose: it renders in
 * both graphs — MemberHeader is a client component and SiteHeader is
 * mounted by the client-side SessionHeader gate. Keep it server-free.
 */
export function PageContainer({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className="px-4 sm:px-7 lg:px-10">
      <div className={cn("mx-auto max-w-content", className)} {...props} />
    </div>
  );
}
