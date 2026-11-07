/*
 * Blocked-paste detection (card S1-03b §7). Pure functions — no DOM, no
 * TipTap types — so they run in the plain node test environment. The
 * interceptor itself lives in RichTextEditor's editorProps.handlePaste,
 * which runs BEFORE the Link and prosemirror-tables plugins and therefore
 * still sees a video URL as plain text.
 */

const EMBED_TAGS = [
  "iframe",
  "video",
  "embed",
  "object",
  "script",
  "audio",
] as const;

/** Anywhere in pasted HTML — case-insensitive tag open. */
const EMBED_TAG_IN_HTML = new RegExp(`<(${EMBED_TAGS.join("|")})\\b`, "i");

/** The pasted plain text IS embed code copied from a "Share → Embed" box. */
const EMBED_TAG_LEADS_TEXT = new RegExp(`^<(${EMBED_TAGS.join("|")})\\b`, "i");

const VIDEO_HOSTS = [
  "youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "vimeo.com",
  "tiktok.com",
  "dailymotion.com",
  "dai.ly",
] as const;

const VIDEO_PATH = /\.(?:mp4|webm|mov|m4v|m3u8|mkv|avi|ogv)$/i;

export type BlockedPaste =
  | { readonly kind: "embed-html" }
  | { readonly kind: "embed-code" }
  | { readonly kind: "video-link"; readonly url: string };

export function detectBlockedPaste(input: {
  html?: string | null;
  text?: string | null;
}): BlockedPaste | null {
  const html = input.html ?? null;
  const text = (input.text ?? "").trim();

  if (html !== null && EMBED_TAG_IN_HTML.test(html)) {
    return { kind: "embed-html" };
  }
  if (text !== "" && EMBED_TAG_LEADS_TEXT.test(text)) {
    return { kind: "embed-code" };
  }
  if (isSingleVideoUrl(text)) {
    return { kind: "video-link", url: text };
  }
  return null;
}

/** One http(s) URL, no whitespace anywhere, on a video host or ending in
 *  a video file extension. A URL inside a sentence is NOT one. */
function isSingleVideoUrl(value: string): boolean {
  if (value === "" || /\s/.test(value)) return false;
  if (!/^https?:\/\//i.test(value)) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  const onVideoHost = VIDEO_HOSTS.some(
    (base) => host === base || host.endsWith(`.${base}`),
  );
  if (onVideoHost) return true;
  return VIDEO_PATH.test(url.pathname);
}
