"use client";

import type { ComponentProps } from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

/*
 * Checkbox (card A-05). The ROOT is a full 44px button so the touch
 * target meets the minimum at every width; the visual 20px box sits
 * centered inside it. Hover warms the border, focus comes from the
 * global :focus-visible ring, and disabled is a SOLID fill (no opacity).
 */

export type CheckboxProps = ComponentProps<typeof CheckboxPrimitive.Root>;

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "group relative inline-flex size-11 shrink-0 items-center justify-center rounded-control disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-sm border-2 border-border-strong bg-surface transition-colors duration-200 ease-out",
          "group-hover:border-primary",
          "group-data-[state=checked]:border-primary group-data-[state=checked]:bg-primary",
          "group-data-[state=checked]:group-hover:bg-primary-deep",
          "group-disabled:border-transparent group-disabled:bg-surface-disabled",
        )}
      >
        <CheckboxPrimitive.Indicator>
          <Check
            aria-hidden="true"
            strokeWidth={3}
            className="size-3.5 text-surface group-disabled:text-text-subtle"
          />
        </CheckboxPrimitive.Indicator>
      </span>
    </CheckboxPrimitive.Root>
  );
}
