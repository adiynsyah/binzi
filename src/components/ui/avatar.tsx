/* eslint-disable @next/next/no-img-element -- avatars are tiny fixed-size
   images that must also accept the data-URI placeholder used by /dev/ui;
   next/image optimization adds nothing here. */
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

/*
 * Avatar (card A-05, screen 17b): one shape — fully rounded. Renders the
 * initial derived from `name`, or the photo when `src` is given. The demo
 * photo placeholder lives in /dev/ui only, never in this component.
 *
 * A-14b: the initial is ONE letter — the first character of the name,
 * uppercased. Every avatar in the member designs (13a, 8a, 8e, 28a, 19a)
 * draws a single letter, so the earlier two-word rule was the deviation.
 *
 * Decorative mode: pass aria-hidden when the avatar sits beside the user's
 * name or inside a labelled control (the "Menu akun" button) — it then
 * carries no role/label of its own, so screen readers are not read the
 * name twice.
 */

const sizeClasses = {
  sm: "size-8 text-xs",
  md: "size-11 text-sm",
  lg: "size-14 text-base",
} as const;

const sizePx = { sm: 32, md: 44, lg: 56 } as const;

/** First letter of the name, uppercased; "?" when it has none. */
function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export type AvatarProps = {
  /** Full display name — source of the initial and the alt text. */
  name: string;
  /** Photo URL; omit for the initial fallback. */
  src?: string;
  size?: keyof typeof sizeClasses;
  className?: string;
} & Pick<ComponentProps<"span">, "aria-hidden" | "aria-label" | "id">;

export function Avatar({ name, src, size = "md", className, ...rest }: AvatarProps) {
  const decorative =
    rest["aria-hidden"] === true || rest["aria-hidden"] === "true";

  if (src) {
    return (
      <img
        src={src}
        alt={decorative ? "" : name}
        width={sizePx[size]}
        height={sizePx[size]}
        className={cn("rounded-pill object-cover", sizeClasses[size], className)}
        {...rest}
      />
    );
  }
  return (
    <span
      {...rest}
      {...(decorative ? {} : { role: "img" as const, "aria-label": name })}
      className={cn(
        "inline-flex items-center justify-center rounded-pill bg-fill font-bold text-text-muted",
        sizeClasses[size],
        className,
      )}
    >
      {initialOf(name)}
    </span>
  );
}
