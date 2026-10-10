"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { AlertCircle, Check, Info } from "lucide-react";
import { cn } from "../../lib/utils";

/*
 * Banner (card A-06, screen 28c): inline feedback — there is deliberately
 * no separate toast component. Error banners are assertive (role="alert"),
 * success banners are polite (role="status") and dismiss THEMSELVES after
 * 4 seconds. The countdown pauses while the banner is hovered or focused
 * (e.g. its action button) and resumes with the REMAINING time, so a
 * slower reader never loses the message. Info and error banners never arm
 * a timer on any path — they stay until the caller unmounts them.
 *
 * Token pairs: text on a *-tint always uses its dark pair; the success
 * border reuses `border-success` because TOKENS.md defines no soft line
 * pair for success-tint yet (see PR notes).
 */

export const BANNER_AUTO_DISMISS_MS = 4000;

const TONES = {
  info: {
    container:
      "border-warning-tint-line bg-warning-tint text-warning-tint-text",
    dot: "bg-warning",
    Icon: Info,
  },
  error: {
    container:
      "border-danger-tint-line bg-danger-tint text-danger-tint-text",
    dot: "bg-danger",
    Icon: AlertCircle,
  },
  success: {
    container: "border-success bg-success-tint text-success-tint-text",
    dot: "bg-success",
    Icon: Check,
  },
} as const;

export type BannerTone = keyof typeof TONES;

export type BannerProps = Omit<ComponentProps<"div">, "title"> & {
  tone: BannerTone;
  title: ReactNode;
  description?: ReactNode;
  /** Optional action inside the banner (e.g. a retry Button). */
  action?: ReactNode;
  /**
   * Called when a success banner dismisses itself. Info and error banners
   * stay until the caller unmounts them (28c: persistent while offline).
   */
  onDismissed?: () => void;
  /** Self-dismiss delay for success banners; 0 disables it. */
  autoDismissMs?: number;
};

export function Banner({
  tone,
  title,
  description,
  action,
  onDismissed,
  autoDismissMs = BANNER_AUTO_DISMISS_MS,
  className,
  ...props
}: BannerProps) {
  const { container, dot, Icon } = TONES[tone];
  const [dismissed, setDismissed] = useState(false);
  // Success-only: info/error banners must never arm a timer from any path
  // (mount, mouse leave, blur) — 28c keeps them until the caller unmounts.
  const autoDismiss = tone === "success" && autoDismissMs > 0;

  // Refs keep the timer stable across renders without re-arming on every
  // callback change.
  const onDismissedRef = useRef(onDismissed);
  useEffect(() => {
    onDismissedRef.current = onDismissed;
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remaining = useRef(autoDismissMs);
  const startedAt = useRef(0);

  const clear = () => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const pause = () => {
    if (timer.current === null) return; // already fired or paused
    remaining.current -= Date.now() - startedAt.current;
    clear();
  };

  const resume = () => {
    if (!autoDismiss || dismissed || timer.current !== null) return;
    startedAt.current = Date.now();
    timer.current = setTimeout(() => {
      clear();
      setDismissed(true);
      onDismissedRef.current?.();
    }, Math.max(remaining.current, 0));
  };

  useEffect(() => {
    if (autoDismiss) {
      remaining.current = autoDismissMs;
      resume();
    }
    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- arm once per mount
  }, []);

  if (dismissed) return null;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocusCapture={pause}
      onBlurCapture={resume}
      className={cn(
        "flex items-start gap-3 rounded-control border p-4",
        container,
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-pill text-surface",
          dot,
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold">{title}</p>
        {description ? <p className="mt-1 text-sm">{description}</p> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}
