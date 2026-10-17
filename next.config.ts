import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
// Read at build time on Vercel: "production" | "preview" | "development"
// (the last only for `vercel dev`, which this app does not use).
const isVercelPreview = process.env.VERCEL_ENV === "preview";

// Content-Security-Policy (card A-16b, PRD §12.5 v1.5, decision Q45 —
// option b+ in docs/decisions/csp.md): ONE enforced policy for every route
// (pages, API routes, static assets) through one catch-all source, replacing
// the enforced/report-only pair from A-16. Base sources follow §12.5 exactly;
// per-environment additions are appended AFTER the base sources, never
// before:
// - development: 'unsafe-eval' in script-src for next dev tooling.
// - Vercel preview: toolbar origins per vercel.com/docs/vercel-toolbar/
//   managing-toolbar ("Using a Content Security Policy").
// - production: no additions — no 'unsafe-eval', no vercel.live.
// R2 entries wait for S1/S2, Sentry for its SDK. media-src 'self' is a
// deliberate placeholder until the R2 domain exists.
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  "https://challenges.cloudflare.com",
  ...(isDev ? ["'unsafe-eval'"] : []),
  ...(isVercelPreview ? ["https://vercel.live"] : []),
];

const styleSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(isVercelPreview ? ["https://vercel.live"] : []),
];

const imgSrc = [
  "'self'",
  "data:",
  ...(isVercelPreview
    ? ["https://vercel.live", "https://vercel.com", "blob:"]
    : []),
];

const fontSrc = [
  "'self'",
  ...(isVercelPreview
    ? ["https://vercel.live", "https://assets.vercel.com"]
    : []),
];

const connectSrc = [
  "'self'",
  ...(isVercelPreview
    ? ["https://vercel.live", "wss://ws-us3.pusher.com"]
    : []),
];

const frameSrc = [
  "https://challenges.cloudflare.com",
  ...(isVercelPreview ? ["https://vercel.live"] : []),
];

const csp = [
  "default-src 'self'",
  `script-src ${scriptSrc.join(" ")}`,
  "script-src-attr 'none'",
  `style-src ${styleSrc.join(" ")}`,
  `img-src ${imgSrc.join(" ")}`,
  `font-src ${fontSrc.join(" ")}`,
  "media-src 'self'",
  `connect-src ${connectSrc.join(" ")}`,
  `frame-src ${frameSrc.join(" ")}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  experimental: {
    // forbidden() 403 interrupts (card A-12) — still experimental in
    // Next 16.3.7 (docs: 03-api-reference/05-config/01-next-config-js/authInterrupts).
    authInterrupts: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
