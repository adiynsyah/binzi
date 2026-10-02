"use client";

import type { ComponentProps } from "react";
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { cn } from "../../lib/utils";

/*
 * Dropdown menu (card A-06): together with dialogs, the only floating
 * layer allowed a shadow — `shadow-menu` from tokens.css. Cards use
 * borders instead. Items keep the 44px minimum touch target, highlight
 * with `fill`, and focus uses the global 2px ring (globals.css).
 */

export const DropdownMenu = DropdownMenuPrimitive.Root;
export type DropdownMenuProps = ComponentProps<typeof DropdownMenuPrimitive.Root>;

export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export type DropdownMenuTriggerProps = ComponentProps<
  typeof DropdownMenuPrimitive.Trigger
>;

export const DropdownMenuGroup = DropdownMenuPrimitive.Group;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-48 rounded-control border border-border bg-surface p-1 shadow-menu",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "duration-200 ease-out",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "flex min-h-11 cursor-default select-none items-center gap-2 rounded-control px-3 text-sm font-bold text-text outline-none",
        "data-[highlighted]:bg-fill",
        // Solid disabled colors — never opacity (TOKENS.md).
        "data-[disabled]:pointer-events-none data-[disabled]:text-text-subtle data-[disabled]:hover:bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn(
        "px-3 py-2 font-mono text-xs uppercase tracking-wide text-text-subtle",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("my-2 h-px bg-border-soft", className)}
      {...props}
    />
  );
}
