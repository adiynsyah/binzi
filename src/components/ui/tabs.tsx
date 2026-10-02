"use client";

import type { ComponentProps } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "../../lib/utils";

/*
 * Tabs — underline style (card A-05): the active tab carries a 2px
 * primary underline. The transparent 2px border is ALWAYS present so
 * activating a tab never shifts layout. Triggers are min 44px tall
 * (touch target). Hover warms the label; focus is the global ring.
 */

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "flex w-full items-stretch border-b border-border-soft",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex min-h-11 flex-1 items-center justify-center gap-2 border-b-2 border-transparent px-4 text-sm font-bold text-text-meta transition-colors duration-200 ease-out",
        "hover:text-text",
        "data-[state=active]:border-primary data-[state=active]:text-text",
        "data-[disabled]:cursor-not-allowed data-[disabled]:text-text-subtle data-[disabled]:hover:text-text-subtle",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("pt-4 text-text-body", className)}
      {...props}
    />
  );
}
