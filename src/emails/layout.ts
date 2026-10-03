// Shared HTML construction for transactional emails (card A-10, screens
// 15a/15b: one column, 566px copy inside a 600px client frame).
//
// Pure functions with no server imports, so templates are unit-testable in
// isolation. Security rules for every dynamic value (PRD §12.1):
// - text passes through `escapeHtml()` before interpolation,
// - link URLs pass through `httpUrl()` (http/https only) and are escaped
//   again for the attribute context.
// Layout is table-based with inline styles only — clients such as Gmail
// strip <style> blocks, and the design stays readable with images blocked
// (the brand mark is text, not an image).
import { t } from "./tokens";

const FONT_SANS =
  "'Lato', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const FONT_MONO =
  "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace";

/** Escapes a value for interpolation as HTML text or an attribute value. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Accepts only absolute http(s) URLs for email links. Anything else
 * (`javascript:`, `data:`, relative paths) throws — the caller treats that
 * as a failed send instead of mailing a dangerous link.
 */
export function httpUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("URL email tidak valid (bukan URL absolut)");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(
      `URL email hanya boleh http/https, dapat ${parsed.protocol}`,
    );
  }
  return url;
}

/** First word of the display name; falls back to the email's local part. */
export function displayFirstName(
  name: string | null | undefined,
  email: string,
): string {
  const trimmed = (name ?? "").trim();
  if (trimmed) return trimmed.split(/\s+/)[0] ?? trimmed;
  return email.split("@")[0] || "Anda";
}

export type RenderedEmail = {
  subject: string;
  preheader: string;
  html: string;
};

export type EmailShellInput = {
  subject: string;
  preheader: string;
  /** Card content, assembled from the helpers below. */
  content: string;
  /** Recipient address, echoed in the automated-send footer line. */
  recipientEmail: string;
};

/**
 * Wraps card content in the shared shell: canvas background, bordered card,
 * text brand mark, and the standard footer (automation notice + legal line
 * + sender line — plain text because the legal pages do not exist yet).
 */
export function renderEmail(input: EmailShellInput): RenderedEmail {
  const html = [
    "<!doctype html>",
    '<html lang="id">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(input.subject)}</title>`,
    "</head>",
    `<body style="margin:0;padding:0;background-color:${t("surface-3")};">`,
    // Hidden preheader: preview text in the inbox list, invisible when read.
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${t("surface-3")};">`,
    '<tr><td align="center" style="padding:24px 12px;">',
    // 600px client frame from 15a; `max-width` keeps it usable at 360px.
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background-color:${t("surface")};border:1px solid ${t("border")};border-radius:14px;">`,
    "<tr>",
    `<td style="padding:28px 34px 0;font-family:${FONT_SANS};">`,
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>',
    `<td width="36" height="36" style="width:36px;height:36px;background-color:${t("text")};border-radius:999px;color:${t("surface")};font-weight:900;font-size:17px;line-height:36px;text-align:center;vertical-align:middle;">B</td>`,
    `<td style="padding-left:10px;color:${t("primary")};font-family:${FONT_MONO};font-weight:700;font-size:15px;letter-spacing:4px;vertical-align:middle;">BINZI</td>`,
    "</tr></table>",
    "</td>",
    "</tr>",
    `<tr><td style="padding:22px 34px 0;font-family:${FONT_SANS};">${input.content}</td></tr>`,
    "<tr>",
    `<td style="padding:28px 34px 30px;font-family:${FONT_SANS};">`,
    `<div style="border-top:1px solid ${t("border-soft")};padding-top:18px;font-size:12px;line-height:1.7;color:${t("text-meta")};">`,
    `Email ini dikirim otomatis ke ${escapeHtml(input.recipientEmail)} karena ada aktivitas pada akun BINZI Anda.<br>`,
    "Kebijakan Privasi &middot; Syarat &amp; Ketentuan<br>",
    `<span style="color:${t("text-muted")};">BINZI &middot; edukasi gizi berbahasa Indonesia &middot; Jakarta, Indonesia</span>`,
    "</div>",
    "</td>",
    "</tr>",
    "</table>",
    "</td></tr>",
    "</table>",
    "</body>",
    "</html>",
  ].join("");
  return { subject: input.subject, preheader: input.preheader, html };
}

/** Card headline (26px black per 15a). */
export function h1(text: string): string {
  return `<h1 style="margin:0 0 14px;font-size:26px;line-height:1.3;font-weight:900;color:${t("text")};">${text}</h1>`;
}

/** Body paragraph (15px, 1.6 per 15a). Text must already be escaped. */
export function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${t("text-body")};">${text}</p>`;
}

function actionButton(
  label: string,
  url: string,
  backgroundColor: string,
): string {
  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 24px;"><tr>',
    `<td style="border-radius:10px;background-color:${backgroundColor};">`,
    `<a href="${escapeHtml(httpUrl(url))}" style="display:inline-block;padding:14px 28px;font-family:${FONT_SANS};font-weight:700;font-size:15px;color:${t("surface")};text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a>`,
    "</td></tr></table>",
  ].join("");
}

/** Primary (brand red) action button. */
export function primaryButton(label: string, url: string): string {
  return actionButton(label, url, t("primary"));
}

/** Dark action button for security-critical actions (password reset). */
export function darkButton(label: string, url: string): string {
  return actionButton(label, url, t("text"));
}

/**
 * The raw-link fallback box (15a: "Tombol tidak bekerja? Salin alamat
 * ini:"). Shows the full URL — the truncation in the design mock is a
 * canvas artifact, a real fallback must be copyable.
 */
export function fallbackLinkBox(
  lead: string,
  note: string | null,
  url: string,
): string {
  const noteHtml = note
    ? `<p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:${t("text-muted")};">${escapeHtml(note)}</p>`
    : "";
  return [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr>`,
    `<td style="background-color:${t("surface-2")};border:1px solid ${t("border-soft")};border-radius:10px;padding:14px 16px;">`,
    `<p style="margin:0 0 6px;font-size:13px;line-height:1.6;font-weight:700;color:${t("text-muted")};">${escapeHtml(lead)}</p>`,
    noteHtml,
    `<p style="margin:6px 0 0;font-family:${FONT_MONO};font-size:13px;line-height:1.6;"><a href="${escapeHtml(httpUrl(url))}" style="color:${t("text-body")};text-decoration:underline;word-break:break-all;">${escapeHtml(url)}</a></p>`,
    "</td></tr></table>",
  ].join("");
}

/** Soft warning box (15a reset email: validity + device/time metadata). */
export function warningBox(html: string): string {
  return [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr>`,
    `<td style="background-color:${t("warning-tint")};border:1px solid ${t("warning-tint-line")};border-radius:10px;padding:14px 16px;font-size:13px;line-height:1.6;color:${t("warning-tint-text")};">`,
    html,
    "</td></tr></table>",
  ].join("");
}

/** The reassuring "bukan Anda?" line — bold lead, calm rest (15a). */
export function reassurance(strong: string, rest: string): string {
  return `<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:${t("text-muted")};"><strong style="color:${t("text")};">${escapeHtml(strong)}</strong> ${escapeHtml(rest)}</p>`;
}

/** Section heading inside the card (15a welcome: "Tiga hal yang…"). */
export function sectionHeading(text: string): string {
  return `<p style="margin:28px 0 12px;font-size:15px;font-weight:700;color:${t("text")};">${escapeHtml(text)}</p>`;
}

/** Numbered list item rendered as a bold mono "01 ·" prefix (15a). */
export function numberedItem(number: string, html: string): string {
  return `<p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:${t("text-body")};"><strong style="font-family:${FONT_MONO};color:${t("text")};">${escapeHtml(number)} &middot;</strong> ${html}</p>`;
}
