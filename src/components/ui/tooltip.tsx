"use client";

import type { ComponentProps } from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/*
 * Tooltip (card A-15 step 6): shadcn-style wrapper over the Tooltip
 * primitive of the already-installed `radix-ui` package — no new dependency.
 * Used for the CMS icon-rail labels; Radix shows it on hover AND on keyboard
 * focus, and handles Escape/blur dismissal. Like menus and dialogs, the
 * floating layer may carry the menu shadow (TOKENS) — cards never do.
 *
 * Wrap a row of triggers in <TooltipProvider> once so the open delay is
 * shared and skippable between them; a bare <Tooltip> also works (Radix
 * falls back to its built-in defaults).
 */

export const TooltipProvider = TooltipPrimitive.Provider;
export type TooltipProviderProps = ComponentProps<
  typeof TooltipPrimitive.Provider
>;

export const Tooltip = TooltipPrimitive.Root;
export type TooltipProps = ComponentProps<typeof TooltipPrimitive.Root>;

export const TooltipTrigger = TooltipPrimitive.Trigger;
export type TooltipTriggerProps = ComponentProps<
  typeof TooltipPrimitive.Trigger
>;

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded-control border border-border bg-surface px-2.5 py-1.5 text-[13px] font-bold text-text shadow-menu",
          "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-in-95",
          "duration-200 ease-out",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}
