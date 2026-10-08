"use client";

import { useEffect, useRef } from "react";

// Cloudflare Turnstile widget (card A-13, AUTH-10) — no third-party React
// wrapper: the official script is loaded once per page and the widget is
// rendered explicitly into a container div. The TOKEN it produces is
// single-use; owning forms remount the widget (key change) after every
// submit so a fresh token is produced for the next attempt.

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js";

// Minimal surface of window.turnstile this component touches.
type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      size?: "normal" | "compact" | "flexible";
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.addEventListener("load", () => resolve());
      script.addEventListener("error", () => {
        scriptPromise = null;
        reject(new Error("Gagal memuat script Turnstile"));
      });
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export type TurnstileWidgetProps = {
  siteKey: string;
  /** Fires with the single-use token once the challenge passes. */
  onVerify: (token: string) => void;
  /** Token expired or errored — the owner must drop the stored token. */
  onExpire?: () => void;
  className?: string;
};

export function TurnstileWidget({
  siteKey,
  onVerify,
  onExpire,
  className,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  // Keep latest callbacks without re-rendering the widget.
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onVerifyRef.current = onVerify;
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(
          containerRef.current,
          {
            sitekey: siteKey,
            size: "flexible",
            callback: (token) => onVerifyRef.current(token),
            "expired-callback": () => onExpireRef.current?.(),
            "error-callback": () => onExpireRef.current?.(),
          },
        );
      })
      .catch(() => onExpireRef.current?.());
    return () => {
      cancelled = true;
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  return (
    <div className={className ?? "w-full"}>
      <div
        ref={containerRef}
        role="complementary"
        aria-label="Verifikasi anti-robot Cloudflare Turnstile"
        className="min-h-11 w-full"
      />
    </div>
  );
}
