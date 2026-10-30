"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Banner } from "@/components/ui/banner";
import { useSignOut } from "@/components/shared/use-sign-out";

/*
 * CMS account menu (card A-15 step 8), ≥ 640px only: the A-06 dropdown
 * behind the sidebar user block (≥ 1024) and the rail avatar (640–1023).
 * The CMS designs draw no Keluar — "Lihat situs" + "Keluar" is a conscious
 * addition (noted in the PR). Keluar reuses useSignOut (→ / + refresh,
 * items locked while in flight, failure keeps the menu open and shows the
 * generic Banner notice).
 *
 * Exactly ONE trigger per DropdownMenu (PR #53 lesson): callers pass their
 * own single trigger element as children — a <button> — which Radix wraps
 * via asChild, labelling it aria-haspopup="menu" and managing aria-expanded
 * (Enter/Space opens, arrows move, Esc closes, focus returns to the trigger).
 */
export function CmsAccountMenu({ children }: { children: ReactElement }) {
  const { pending, error, signOut } = useSignOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      {/* side="top": the trigger sits at the BOTTOM of the sidebar/rail;
          collisionPadding keeps the menu ~8px off the left screen edge at
          1280 (align="start" would otherwise flush it to x≈1). */}
      <DropdownMenuContent
        side="top"
        align="start"
        collisionPadding={8}
        className="w-56"
      >
        <DropdownMenuItem asChild disabled={pending}>
          <Link href="/">Lihat situs</Link>
        </DropdownMenuItem>
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
