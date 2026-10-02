"use client";

import type { ComponentProps } from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "../../lib/utils";

/*
 * Toggle (card A-05): 48×28 track. The visual is shorter than the 44px
 * touch minimum, so a ::before pseudo-element extends the hit area
 * vertically — pointer events on the pseudo forward to the switch.
 * Disabled keeps the solid disabled fill (no opacity).
 */

export type ToggleProps = ComponentProps<typeof SwitchPrimitive.Root>;

export function Toggle({ className, ...props }: ToggleProps) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "group relative inline-flex h-7 w-12 shrink-0 items-center rounded-pill border-2 transition-colors duration-200 ease-out",
        "before:absolute before:-inset-x-1 before:-inset-y-2 before:content-['']",
        "data-[state=unchecked]:border-border-strong data-[state=unchecked]:bg-surface data-[state=unchecked]:hover:bg-fill",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:hover:border-primary-deep data-[state=checked]:hover:bg-primary-deep",
        "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-disabled disabled:hover:bg-surface-disabled",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none ml-0.5 block size-5 rounded-pill bg-surface transition-transform duration-200 ease-out",
          "data-[state=checked]:translate-x-5",
          "group-disabled:bg-text-subtle",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
