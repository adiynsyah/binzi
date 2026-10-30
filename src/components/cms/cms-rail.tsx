"use client";

import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CmsAccountMenu } from "./cms-account-menu";
import { CMS_ICONS } from "./cms-icons";
import {
  getActiveCmsItem,
  type CmsMenuGroup,
  type CmsUser,
} from "./cms-nav";

/*
 * CMS icon rail, 640–1023px (card A-15 step 6; screen 19e left): 72 wide
 * plus a 1px right border on surface-2, centered content, same sticky
 * h-dvh + own-scroll behavior as the sidebar. Labels live in tooltips
 * (hover AND keyboard focus) via the A-15 tooltip primitive; groups are
 * separated by a thin line instead of a label. The bottom avatar is the ONE
 * trigger of the CMS account menu.
 */

type CmsRailProps = {
  groups: CmsMenuGroup[];
  user: CmsUser;
};

export function CmsRail({ groups, user }: CmsRailProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = getActiveCmsItem(
    pathname,
    searchParams.get("status"),
    user.role,
  );

  return (
    <aside className="sticky top-0 hidden h-dvh w-[73px] shrink-0 flex-col items-center border-r border-border-soft bg-surface-2 sm:flex lg:hidden">
      <div className="flex flex-none items-center pb-3.5 pt-[18px]">
        <Link href="/cms">
          <Image
            src="/brand/logo-binzi-mark.png"
            alt="BINZI CMS"
            width={715}
            height={645}
            priority
            className="block h-[28px] w-auto"
          />
        </Link>
      </div>

      <nav
        aria-label="Menu CMS"
        className="flex w-full flex-1 flex-col items-center overflow-y-auto px-2 py-2.5"
      >
        <TooltipProvider delayDuration={300}>
          {groups.map((group, index) => (
            <Fragment key={group.id}>
              {index > 0 ? (
                <div aria-hidden="true" className="my-2 h-px w-10 shrink-0 bg-border-soft" />
              ) : null}
              <div className="flex flex-col items-center gap-1">
                {group.items.map((item) => {
                  const Icon = CMS_ICONS[item.icon];
                  const isActive = active?.id === item.id;
                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>
                        <Link
                          href={item.href}
                          aria-label={item.label}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "grid size-11 place-items-center rounded-control transition-colors duration-200 ease-out",
                            isActive
                              ? "bg-text text-surface"
                              : "text-text-muted hover:bg-fill",
                          )}
                        >
                          <Icon
                            aria-hidden="true"
                            className="size-[18px]"
                            strokeWidth={1.8}
                          />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </Fragment>
          ))}
        </TooltipProvider>
      </nav>

      <CmsAccountMenu>
        <button
          type="button"
          aria-label="Menu akun"
          className="grid size-11 place-items-center rounded-control text-text transition-colors duration-200 ease-out hover:bg-fill"
        >
          <Avatar
            name={user.name}
            size="sm"
            aria-hidden="true"
            className="size-9 bg-text text-surface text-[13px]"
          />
        </button>
      </CmsAccountMenu>
    </aside>
  );
}
