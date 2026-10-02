"use client";

import { useId, type ComponentProps } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

/*
 * Dialog (card A-06, COMPONENTS.md → "Dasar"): modal 560 ≥ 640px,
 * bottom sheet below. Radix supplies the focus trap, Esc handling,
 * page scroll lock and focus return to the trigger; `title` is a
 * REQUIRED prop so every dialog is named through aria-labelledby
 * (a `description`, when given, is linked via aria-describedby).
 *
 * Sheet (< 640px): full width, top radius 18, slides in from the bottom
 * edge, respects env(safe-area-inset-bottom) and caps at 90dvh with
 * internal scrolling. Modal (≥ 640px): centered, max 560 wide, radius
 * 16 with the dialog shadow, rising 32px while fading in. Animations
 * are 200ms ease-out and collapse instantly under prefers-reduced-motion
 * (global switch in globals.css).
 */

export const Dialog = DialogPrimitive.Root;
export type DialogProps = ComponentProps<typeof DialogPrimitive.Root>;

export const DialogTrigger = DialogPrimitive.Trigger;
export type DialogTriggerProps = ComponentProps<typeof DialogPrimitive.Trigger>;

export const DialogClose = DialogPrimitive.Close;
export type DialogCloseProps = ComponentProps<typeof DialogPrimitive.Close>;

export type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  /** Dialog title — required; linked to the content via aria-labelledby. */
  title: string;
  /** Optional supporting text, linked via aria-describedby. */
  description?: string;
};

export function DialogContent({
  className,
  title,
  description,
  children,
  ...props
}: DialogContentProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-40 bg-scrim",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          "duration-200 ease-out",
        )}
      />
      <DialogPrimitive.Content
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          // Sheet (< 640px): anchored to the bottom, safe-area aware,
          // max 90dvh with the scroll inside the sheet itself.
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col overflow-y-auto rounded-t-sheet bg-surface",
          "px-6 pt-6 pb-[max(24px,env(safe-area-inset-bottom))]",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom",
          // Modal (≥ 640px): centered 560, radius 16 + dialog shadow,
          // rises 32px instead of sliding the full height.
          "sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-[560px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-dialog sm:pb-6 sm:shadow-dialog",
          "sm:data-[state=open]:slide-in-from-bottom-8 sm:data-[state=closed]:slide-out-to-bottom-8",
          "duration-200 ease-out",
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title
          id={titleId}
          className="pr-11 text-lg font-black tracking-tight text-text"
        >
          {title}
        </DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description
            id={descriptionId}
            className="mt-2 text-text-muted"
          >
            {description}
          </DialogPrimitive.Description>
        ) : null}
        {children}
        {/* Close ✕: labelled, ≥ 44px touch target (TOKENS.md). */}
        <DialogPrimitive.Close
          aria-label="Tutup"
          className="absolute right-3 top-3 grid min-h-11 min-w-11 place-items-center rounded-control text-text-muted transition-colors duration-200 ease-out hover:bg-fill hover:text-text"
        >
          <X aria-hidden="true" className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
