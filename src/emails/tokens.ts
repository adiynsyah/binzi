// Color constants for transactional email HTML (card A-10).
//
// Email clients load no stylesheets and support no CSS variables, so inline
// hex values are unavoidable in email HTML. This file is the email-side
// counterpart of `src/styles/tokens.css`: every entry MUST hold the value of
// the token with the same name there (pinned by `tokens.test.ts`), and it is
// the ONLY file under `src/emails/` allowed to contain hex literals
// (scripts/check-hex.mjs). Templates reference colors through `t()` so a
// stray hex anywhere else stays caught by the guard.
export const EMAIL_TOKENS = {
  surface: "#ffffff",
  "surface-2": "#fbfaf8",
  "surface-3": "#f3f1ec",
  text: "#1a1614",
  "text-body": "#4d4741",
  "text-meta": "#6b645c",
  "text-muted": "#5b554f",
  border: "#e7e2db",
  "border-soft": "#eeeae4",
  primary: "#f04030",
  "warning-tint": "#fff8ea",
  "warning-tint-text": "#6b5a2a",
  "warning-tint-line": "#f0dcae",
} as const;

export type EmailTokenName = keyof typeof EMAIL_TOKENS;

/** Resolves a token name to its hex value for inline email CSS. */
export function t(name: EmailTokenName): string {
  return EMAIL_TOKENS[name];
}
