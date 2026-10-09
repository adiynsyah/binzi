import { cva, type VariantProps } from "class-variance-authority";

// Button VARIANTS only, split from button.tsx (A-13 fix): server components
// call buttonVariants() to style links (e.g. the 3c expired-link panel), and
// a cva factory exported from a "use client" module is a client reference
// that cannot be CALLED during server rendering. This module is therefore
// PURE — no directive, no React — and both Button (client) and server
// components import from it. Keep it that way.

export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 py-2 text-balance rounded-control font-bold transition-colors duration-200 ease-out disabled:cursor-not-allowed disabled:pointer-events-none disabled:border-transparent disabled:bg-surface-disabled disabled:text-text-subtle",
  {
    variants: {
      variant: {
        primary: "bg-primary text-surface hover:bg-primary-deep",
        secondary:
          "border border-border-strong bg-surface text-text hover:bg-fill",
        dark: "bg-text text-surface hover:bg-ink-surface",
        ghost: "text-text hover:bg-fill",
        danger: "bg-danger text-surface hover:brightness-90",
      },
      size: {
        lg: "min-h-(--height-button-primary) px-6 text-base",
        md: "min-h-(--height-button-secondary) px-5 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      // Safety net for RAW buttonVariants() callers styling anchors: without
      // a size default, a call like buttonVariants({ variant: "secondary" })
      // silently produced a control with NO height/padding (the size default
      // otherwise lives in the Button component, A-13 visual finding). The
      // Button itself always passes an explicit size, so this default never
      // applies inside it — primary/dark keep their lg band there.
      size: "md",
    },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
