/*
 * Blocked-paste detection tests (card S1-03b "Selesai jika"). Node
 * environment — the module is pure and pulls in nothing browser-side.
 */

import { describe, expect, it } from "vitest";

import { detectBlockedPaste } from "./editor-paste";

describe("detectBlockedPaste — tag terlarang di html", () => {
  it.each([
    "<IFRAME src=\"https://example.com/e\"></iframe>",
    "teks <Video src=\"https://example.com/v.mp4\"></Video> sekitar",
    "<embed src=\"https://example.com/e.swf\">",
    "<object data=\"https://example.com/o\"></object>",
    "<ScRiPt>alert(1)</ScRiPt>",
    "ada <audio src=\"https://example.com/a.mp3\"></audio> di sini",
  ])("%s → embed-html", (html) => {
    expect(detectBlockedPaste({ html, text: "apa pun" })).toStrictEqual({
      kind: "embed-html",
    });
  });

  it("mengalahkan kode sematan di text saat keduanya ada", () => {
    expect(
      detectBlockedPaste({
        html: "<iframe src=\"https://example.com/e\"></iframe>",
        text: "<iframe src=\"https://example.com/e\"></iframe>",
      }),
    ).toStrictEqual({ kind: "embed-html" });
  });
});

describe("detectBlockedPaste — kode sematan sebagai teks", () => {
  it("text yang diawali tag terlarang (dipangkas) → embed-code", () => {
    expect(
      detectBlockedPaste({
        html: null,
        text: '  <iframe width="560" src="https://www.youtube.com/embed/x"></iframe>\n',
      }),
    ).toStrictEqual({ kind: "embed-code" });
  });

  it("tag video di awal text juga embed-code", () => {
    expect(
      detectBlockedPaste({ html: "<p>polos</p>", text: "<video></video>" }),
    ).toStrictEqual({ kind: "embed-code" });
  });
});

describe("detectBlockedPaste — tautan video", () => {
  it.each([
    "https://www.youtube.com/watch?v=x",
    "https://youtu.be/x",
    "https://www.youtube-nocookie.com/embed/x",
    "https://vimeo.com/12345",
    "https://www.tiktok.com/@user/video/123",
    "https://www.dailymotion.com/video/x",
    "https://dai.ly/x",
    "https://m.youtube.com/watch?v=x",
    "https://player.vimeo.com/video/12345",
  ])("%s → video-link", (url) => {
    expect(detectBlockedPaste({ html: null, text: url })).toStrictEqual({
      kind: "video-link",
      url,
    });
  });

  it("spasi di tepi dipangkas dan url bersih dikembalikan", () => {
    expect(
      detectBlockedPaste({ html: null, text: "  https://youtu.be/x\n" }),
    ).toStrictEqual({ kind: "video-link", url: "https://youtu.be/x" });
  });

  it("path berakhiran berkas video di host mana pun, huruf campuran", () => {
    expect(
      detectBlockedPaste({ html: null, text: "https://contoh.id/video.MP4?x=1" }),
    ).toStrictEqual({ kind: "video-link", url: "https://contoh.id/video.MP4?x=1" });
  });
});

describe("detectBlockedPaste — bukan tempelan terlarang", () => {
  it.each([
    ["halaman biasa", { html: null, text: "https://contoh.id/artikel" }],
    [
      "url video di tengah kalimat",
      { html: null, text: "Lihat https://youtu.be/x ya" },
    ],
    [
      "host mirip tanpa kaitan",
      { html: null, text: "https://notyoutube.com/watch?v=x" },
    ],
    [
      "html Google Docs tanpa sematan",
      {
        html:
          '<b style="font-weight:normal">teks</b><span style="color:red">merah</span>',
        text: "teks merah",
      },
    ],
    [
      "tautan https biasa",
      { html: '<a href="https://contoh.id">tautan</a>', text: "tautan" },
    ],
    ["tempelan kosong", { html: null, text: "" }],
  ])("%s → null", (_name, input) => {
    expect(detectBlockedPaste(input)).toBeNull();
  });
});
