// Pure YouTube helpers (card S2-02 §4) — shared by the client player and
// the demo-video CLI script. No server imports, no "use client": both
// environments import this file as-is.

/** The ONE id pattern, shared with the database CHECK on lessons
 *  (migration 0001_video_source.sql) — 11 chars of the Base64-URL alphabet. */
export const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/** Hosts that may carry a YouTube video URL — matched exactly or as a
 *  subdomain (same rule as VIDEO_HOSTS in cms/editor-paste.ts). */
const YOUTUBE_HOSTS = [
  "youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
] as const;

function isYouTubeHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return YOUTUBE_HOSTS.some(
    (base) => host === base || host.endsWith(`.${base}`),
  );
}

/**
 * Extract the 11-char video id from a bare id or one of the accepted URL
 * shapes (card §4): watch?v= (www/m., extra params allowed), youtu.be/,
 * /embed/ (also youtube-nocookie.com), /shorts/. Everything else — other
 * hosts, look-alike hosts (youtube.com.contoh.com, evilyoutube.com,
 * notyoutu.be), non-http(s) schemes, wrong-length ids, watch without v —
 * answers null. The dot in `.${base}` is what keeps suffix look-alikes out.
 */
export function parseYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  if (YOUTUBE_ID_PATTERN.test(trimmed)) return trimmed;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!isYouTubeHost(url.hostname)) return null;

  // watch pages carry the id in the query string (?v=ID&t=… both allowed)
  const v = url.searchParams.get("v");
  if (v !== null) {
    return YOUTUBE_ID_PATTERN.test(v) ? v : null;
  }

  const segments = url.pathname.split("/").filter((segment) => segment !== "");
  const host = url.hostname.toLowerCase();
  // youtu.be/ID — the whole path is the id (m.youtu.be included via the
  // subdomain rule).
  if (
    segments.length === 1 &&
    (host === "youtu.be" || host.endsWith(".youtu.be"))
  ) {
    return YOUTUBE_ID_PATTERN.test(segments[0]!) ? segments[0]! : null;
  }
  // youtube.com/embed/ID, youtube-nocookie.com/embed/ID, youtube.com/shorts/ID
  // — path forms only on the full hosts, never on youtu.be.
  const fullHost =
    host === "youtube.com" ||
    host.endsWith(".youtube.com") ||
    host === "youtube-nocookie.com" ||
    host.endsWith(".youtube-nocookie.com");
  if (
    fullHost &&
    segments.length === 2 &&
    (segments[0] === "embed" || segments[0] === "shorts")
  ) {
    return YOUTUBE_ID_PATTERN.test(segments[1]!) ? segments[1]! : null;
  }
  return null;
}

/**
 * The privacy-enhanced embed URL (card §5.B): youtube-nocookie.com with
 * enablejsapi=1 (the IFrame API attaches to this iframe), origin encoded
 * so the API can postMessage back, rel=0, playsinline=1 (iOS Safari,
 * checked at gladi resik) and iv_load_policy=3. `start` is appended ONLY
 * for n > 0 — a fresh play must not carry start=0 (mutation 6). Built with
 * URL/URLSearchParams, never string concatenation.
 */
export function youtubeEmbedUrl(
  videoId: string,
  options: { origin: string; startSeconds?: number },
): string {
  const params = new URLSearchParams({
    enablejsapi: "1",
    origin: options.origin,
    rel: "0",
    playsinline: "1",
    iv_load_policy: "3",
  });
  if (options.startSeconds !== undefined && options.startSeconds > 0) {
    params.set("start", String(Math.floor(options.startSeconds)));
  }
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}
