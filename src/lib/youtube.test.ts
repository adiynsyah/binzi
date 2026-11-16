import { describe, expect, it } from "vitest";

import { YOUTUBE_ID_PATTERN, parseYouTubeId, youtubeEmbedUrl } from "./youtube";

// Card S2-02 §4 + "Selesai jika · youtube.test.ts": every accepted link
// shape → its id; the reject list (other hosts, look-alike hosts,
// javascript:, wrong-length ids, watch without v); and the embed URL with
// and without start, encoded origin, and the nocookie host.

const VALID_ID = "e2eVideo001"; // exactly 11 chars

describe("parseYouTubeId — accepted", () => {
  it.each([
    ["bare 11-char id", VALID_ID],
    [
      "watch www, extra params allowed",
      `https://www.youtube.com/watch?v=${VALID_ID}&t=42s`,
    ],
    ["watch m.", `https://m.youtube.com/watch?v=${VALID_ID}`],
    ["watch bare host", `https://youtube.com/watch?v=${VALID_ID}`],
    ["short host", `https://youtu.be/${VALID_ID}`],
    ["short host with timestamp", `https://youtu.be/${VALID_ID}?t=30`],
    ["embed www", `https://www.youtube.com/embed/${VALID_ID}`],
    ["embed nocookie", `https://www.youtube-nocookie.com/embed/${VALID_ID}`],
    ["shorts", `https://www.youtube.com/shorts/${VALID_ID}`],
    ["surrounding whitespace is trimmed", `  ${VALID_ID}  `],
  ])("%s", (_label, input) => {
    expect(parseYouTubeId(input)).toBe(VALID_ID);
  });

  it("uppercase and -_ id characters pass the pattern", () => {
    expect(YOUTUBE_ID_PATTERN.test("AbC-_19xyzw")).toBe(true);
  });
});

describe("parseYouTubeId — rejected", () => {
  it.each([
    ["empty string", ""],
    ["whitespace only", "   "],
    ["id 10 characters", "e2eVideo00"],
    ["id 12 characters", "e2eVideo0012"],
    ["id containing /", "e2eVideo0/1"],
    ["id containing +", "e2eVideo0+1"],
    ["watch without v", "https://www.youtube.com/watch?t=42"],
    ["watch with a malformed v", `https://www.youtube.com/watch?v=e2eVideo00`],
    ["other video host", "https://vimeo.com/e2eVideo001"],
    [
      "look-alike suffix host",
      "https://youtube.com.contoh.com/watch?v=e2eVideo001",
    ],
    [
      "look-alike host containing youtube",
      "https://evilyoutube.com/watch?v=e2eVideo001",
    ],
    ["look-alike short host", `https://notyoutu.be/${VALID_ID}`],
    ["javascript: scheme", "javascript:alert(1)"],
    ["not a URL, not an id", "halo semuanya"],
    ["embed path on the short host", `https://youtu.be/embed/${VALID_ID}`],
    ["bare path on youtube.com", `https://www.youtube.com/${VALID_ID}`],
  ])("%s", (_label, input) => {
    expect(parseYouTubeId(input)).toBeNull();
  });
});

describe("youtubeEmbedUrl", () => {
  it("builds the nocookie embed URL with the api params, origin encoded", () => {
    const url = new URL(
      youtubeEmbedUrl(VALID_ID, { origin: "http://localhost:3100" }),
    );
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("www.youtube-nocookie.com");
    expect(url.pathname).toBe(`/embed/${VALID_ID}`);
    expect(url.searchParams.get("enablejsapi")).toBe("1");
    expect(url.searchParams.get("origin")).toBe("http://localhost:3100");
    expect(url.searchParams.get("rel")).toBe("0");
    expect(url.searchParams.get("playsinline")).toBe("1");
    expect(url.searchParams.get("iv_load_policy")).toBe("3");
    // The raw query keeps the origin percent-encoded (URLSearchParams form).
    expect(url.search).toContain("origin=http%3A%2F%2Flocalhost%3A3100");
  });

  it("appends start only when startSeconds > 0", () => {
    const withStart = new URL(
      youtubeEmbedUrl(VALID_ID, {
        origin: "https://binzi.id",
        startSeconds: 84,
      }),
    );
    expect(withStart.searchParams.get("start")).toBe("84");

    for (const startSeconds of [0, -3, undefined]) {
      const url = new URL(
        youtubeEmbedUrl(VALID_ID, { origin: "https://binzi.id", startSeconds }),
      );
      expect(
        url.searchParams.has("start"),
        `startSeconds=${startSeconds}`,
      ).toBe(false);
    }
  });

  it("floors fractional start seconds", () => {
    const url = new URL(
      youtubeEmbedUrl(VALID_ID, {
        origin: "https://binzi.id",
        startSeconds: 84.9,
      }),
    );
    expect(url.searchParams.get("start")).toBe("84");
  });
});
