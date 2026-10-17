"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { UserRole } from "../../lib/rbac";
import { cmsGroupOf, getActiveCmsItem } from "./cms-nav";

/*
 * CMS topbar, ≥ 640px (card A-15 step 9; screens 19a/19e): 58 tall at
 * 640–1023, 62 from 1024 up, with a mono breadcrumb derived from the SAME
 * getActiveCmsItem the sidebar/rail/drawer use ("KONTEN / ARTIKEL") — plain
 * text, never a link. The "Cari konten…" box and action buttons belong to
 * S1/S5 and are deliberately absent. An unrecognized path renders no
 * breadcrumb (only reachable by SUPER_ADMIN through the fail-closed rows).
 */
export function CmsTopbar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = getActiveCmsItem(
    pathname,
    searchParams.get("status"),
    role,
  );
  const group = active ? cmsGroupOf(active) : null;
  const breadcrumb = active
    ? [group?.label, active.label].filter(Boolean).join(" / ")
    : null;

  return (
    <div className="hidden h-[58px] flex-none items-center border-b border-border-soft bg-surface px-[22px] sm:flex lg:h-[62px] lg:px-7">
      {breadcrumb ? (
        <p className="font-mono text-[11.5px] font-medium uppercase tracking-[0.1em] text-text-subtle">
          {breadcrumb}
        </p>
      ) : null}
    </div>
  );
}
