import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Security headers (card A-16, PRD §12.5) applied to every route — pages,
// API routes, and static assets — through one catch-all source. The CSP is
// split in two on purpose:
// - Enforced: only directives that never touch scripts/styles/connections,
//   so ISR pages stay static (PRD §10.4). frame-ancestors in a report-only
//   header protects nothing — report-only never enforces.
// - Report-only: the §12.5 target policy WITHOUT nonces, plus origins
//   already in use (Turnstile script + frame). It records what would break
//   if scripts were tightened today; the decision lives in
//   docs/decisions/csp.md. R2 entries wait for A-17, Sentry for its SDK.
// media-src 'self' is a deliberate placeholder until the R2 domain exists.
const cspReportOnly = [
  "default-src 'self'",
  `script-src 'self' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
  "img-src 'self' data:",
  "font-src 'self'",
  "media-src 'self'",
  "form-action 'self'",
  "frame-src https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
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
