/* eslint-disable @next/next/no-img-element -- avatars are tiny fixed-size
   images that must also accept the data-URI placeholder used by /dev/ui;
   next/image optimization adds nothing here. */
import { cn } from "../../lib/utils";

/*
 * Avatar (card A-05, screen 17b): one shape — fully rounded. Renders the
 * initials derived from `name`, or the photo when `src` is given. The
 * demo photo placeholder lives in /dev/ui only, never in this component.
 */

const sizeClasses = {
  sm: "size-8 text-xs",
  md: "size-11 text-sm",
  lg: "size-14 text-base",
} as const;

const sizePx = { sm: 32, md: 44, lg: 56 } as const;

/** Initials from the first two words, e.g. "Rina Kurnia" → "RK". */
function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase() || "?"
  );
}

export type AvatarProps = {
  /** Full display name — source of the initials and the alt text. */
  name: string;
  /** Photo URL; omit for the initials fallback. */
  src?: string;
  size?: keyof typeof sizeClasses;
  className?: string;
};

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={sizePx[size]}
        height={sizePx[size]}
        className={cn(
          "rounded-pill object-cover",
          sizeClasses[size],
          className,
        )}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        "inline-flex items-center justify-center rounded-pill bg-fill font-bold text-text-muted",
        sizeClasses[size],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
