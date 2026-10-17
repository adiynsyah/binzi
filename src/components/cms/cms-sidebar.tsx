"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "../../lib/utils";
import { Avatar } from "../ui/avatar";
import { CmsAccountMenu } from "./cms-account-menu";
import { CMS_ICONS } from "./cms-icons";
import {
  getActiveCmsItem,
  roleLabel,
  type CmsMenuGroup,
  type CmsUser,
} from "./cms-nav";

/*
 * CMS sidebar, ≥ 1024px (card A-15 step 5; screens 19a/19b/27a): 248 wide
 * plus a 1px right border on surface-2, sticky for the viewport height and
 * scrolling its own content so the user block stays pinned to the bottom.
 * It receives ONLY serializable props from the (cms) layout — the
 * role-filtered groups and { name, role } — and derives the active row
 * itself via the pure getActiveCmsItem (no RBAC import reaches this graph).
 */

type CmsSidebarProps = {
  groups: CmsMenuGroup[];
  user: CmsUser;
};

export function CmsSidebar({ groups, user }: CmsSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = getActiveCmsItem(pathname, searchParams.get("status"), user.role);
  const label = roleLabel(user.role);

  return (
    <aside className="sticky top-0 hidden h-dvh w-[249px] shrink-0 flex-col border-r border-border-soft bg-surface-2 lg:flex">
      {/* Brand row (19a): wordmark 22 tall + "CMS" chip, padding 18/16/14. */}
      <div className="flex flex-none items-center gap-2.5 border-b border-border-soft pb-3.5 pl-4 pr-4 pt-[18px]">
        <Link href="/cms">
          <Image
            src="/brand/logo-binzi-wordmark.png"
            alt="BINZI"
            width={1705}
            height={360}
            priority
            className="block h-[22px] w-auto"
          />
        </Link>
        <span className="rounded-[5px] border border-border px-[7px] py-[3px] font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-text-subtle">
          CMS
        </span>
      </div>

      {/* Nav — padding 10/10/0; grouped items indent to 28 (19a). */}
      <nav aria-label="Menu CMS" className="flex-1 overflow-y-auto px-2.5 pt-2.5">
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
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex h-11 items-center gap-2.5 rounded-control text-[13.5px] font-bold transition-colors duration-200 ease-out",
                    group.label ? "pl-7 pr-3" : "pl-3 pr-3",
                    isActive
                      ? "bg-text text-surface"
                      : "text-text-nav hover:bg-fill",
                  )}
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

      {/* User block — the ONE trigger of the CMS account menu (step 8). */}
      <CmsAccountMenu>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 border-t border-border-soft px-3.5 pb-4 pt-3.5 text-left transition-colors duration-200 ease-out hover:bg-fill"
        >
          <Avatar
            name={user.name}
            size="sm"
            aria-hidden="true"
            className="size-9 shrink-0 bg-text text-surface text-[13px]"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-bold leading-snug text-text">
              {user.name}
            </span>
            {label ? (
              <span
                className={cn(
                  "mt-0.5 block truncate text-[10.5px] font-bold",
                  user.role === "EDITOR"
                    ? "text-cycle-tint-text"
                    : "text-text-muted",
                )}
              >
                {label}
              </span>
            ) : null}
          </span>
        </button>
      </CmsAccountMenu>
    </aside>
  );
}
