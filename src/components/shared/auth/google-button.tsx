"use client";

import { Button } from "../../ui/button";
import { cn } from "../../../lib/utils";

import { authClient } from "./auth-client";

// Google SSO button (card A-13, AUTH-02). Presentational + one shared
// action: every call site starts the SAME redirect flow, so the provider
// wiring lives here once. The button is only RENDERED when the server says
// the provider is enabled (auth-config.ts, note f) — never a client-side
// env check.
//
// The "G" mark is a monochrome letter badge (design 2a/3a show a neutral
// glyph square); brand-color assets cannot be used because colors outside
// tokens.css are rejected by lint:hex.

export function GoogleGlyph({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-sm border border-border-strong bg-surface text-sm font-black text-text-nav",
        className,
      )}
    >
      G
    </span>
  );
}

export type GoogleButtonProps = {
  /** Final label copy, e.g. "Masuk dengan Google" (screen 2a). */
  label: string;
  /** 2c renders the Google action as the PRIMARY button. */
  variant?: "outline" | "primary";
  /** Internal path to land on after a successful Google sign-in. */
  callbackURL: string;
  /** Internal path that receives `?error=<code>` when the flow fails. */
  errorCallbackURL: string;
  className?: string;
};

/** The one Google redirect flow every call site starts (AUTH-02). */
export function startGoogleSignIn(
  callbackURL: string,
  errorCallbackURL: string,
): void {
  void authClient.signIn.social({
    provider: "google",
    callbackURL,
    errorCallbackURL,
  });
}

export function GoogleButton({
  label,
  variant = "outline",
  callbackURL,
  errorCallbackURL,
  className,
}: GoogleButtonProps) {
  return (
    <Button
      type="button"
      variant={variant === "primary" ? "primary" : "secondary"}
      className={cn("w-full", className)}
      onClick={() => startGoogleSignIn(callbackURL, errorCallbackURL)}
    >
      <GoogleGlyph />
      {label}
    </Button>
  );
}
