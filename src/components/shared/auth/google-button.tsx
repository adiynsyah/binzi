"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { authClient } from "./auth-client";

// Google SSO button (card A-13, AUTH-02). Presentational + one shared
// action: every call site starts the SAME redirect flow, so the provider
// wiring lives here once. The button is only RENDERED when the server says
// the provider is enabled (auth-config.ts, note f) — never a client-side
// env check.
//
// Card C-08 f: after a click the button enters its loading state
// ("Mengalihkan…") until the browser actually leaves for Google. A failed
// start (error or throw, before any redirect) restores the button, returns
// focus to it (loading locks via disabled, which drops focus to <body>)
// and calls onError so the owner shows the generic Google message where IT
// owns the error area. A page restored from the back-forward cache
// (pageshow persisted — the user pressed Back on Google's page) also
// restores the button: Safari would otherwise keep a DOM stuck on
// "Mengalihkan…" forever.
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
  /** Fires when the flow fails to START (no redirect happened). */
  onError?: () => void;
  className?: string;
};

/** The one Google redirect flow every call site starts (AUTH-02). Returns
 *  the SDK result so interactive callers can react to a failed start. */
export async function startGoogleSignIn(
  callbackURL: string,
  errorCallbackURL: string,
) {
  return authClient.signIn.social({
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
  onError,
  className,
}: GoogleButtonProps) {
  const [redirecting, setRedirecting] = useState(false);
  // Focus restoration must wait for the commit that re-enables the button
  // (focus() on a still-disabled control is a no-op): fail() only arms the
  // flag; the effect on the redirecting transition does the focusing.
  const restoreFocusRef = useRef(false);
  const wasRedirecting = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Back-forward cache: a restored page never completed the redirect.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setRedirecting(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    if (wasRedirecting.current && !redirecting && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      // loading locked the button with disabled → focus had fallen to
      // <body>; put it back where the failure happened for keyboard users.
      buttonRef.current?.focus();
    }
    wasRedirecting.current = redirecting;
  }, [redirecting]);

  const fail = () => {
    setRedirecting(false);
    restoreFocusRef.current = true;
    onError?.();
  };

  const start = () => {
    // Double activation guard: the disabled attr already blocks real
    // browsers, but synthetic events (and any future re-entry) stop here.
    if (redirecting) return;
    setRedirecting(true);
    void startGoogleSignIn(callbackURL, errorCallbackURL)
      .then((result) => {
        if (result.error) fail();
      })
      .catch(fail);
  };

  return (
    <Button
      ref={buttonRef}
      type="button"
      variant={variant === "primary" ? "primary" : "secondary"}
      className={cn("w-full", className)}
      loading={redirecting}
      loadingLabel="Mengalihkan…"
      onClick={start}
    >
      <GoogleGlyph />
      {label}
    </Button>
  );
}
