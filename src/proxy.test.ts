// Unit tests for the A-12 proxy (card A-12): cookie-presence check only,
// forged header handling, and the /masuk redirect target. The proxy runs
// against real NextRequest/NextResponse objects; the matcher itself is
// exercised end-to-end in dev/build, so here it is only asserted as data
// (it must never list /api/** — owner decision #8).
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "./proxy";

const ORIGIN = "https://binzi.test";
const PATHNAME_HEADER = "x-binzi-pathname";
const SEARCH_HEADER = "x-binzi-search";

function request(
  path: string,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(`${ORIGIN}${path}`, { headers });
}

// NextResponse.next({ request: { headers } }) surfaces the forwarded
// request headers on the response object (next/dist response spec
// extension) — that is how these tests observe the overwrite behavior.
const FORWARDED = "x-middleware-override-headers";

describe("proxy — no session cookie", () => {
  it("redirects /cms/pengguna to /masuk with next=path+query", () => {
    const response = proxy(request("/cms/pengguna?tab=1"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      `${ORIGIN}/masuk?next=%2Fcms%2Fpengguna%3Ftab%3D1`,
    );
  });

  it("redirects /belajar and /profil the same way", () => {
    expect(proxy(request("/belajar")).headers.get("location")).toBe(
      `${ORIGIN}/masuk?next=%2Fbelajar`,
    );
    expect(proxy(request("/profil")).headers.get("location")).toBe(
      `${ORIGIN}/masuk?next=%2Fprofil`,
    );
  });

  it("builds next only from the real URL — a forged x-binzi-pathname never reaches the redirect", () => {
    const response = proxy(
      request("/belajar/gizi-dasar", {
        [PATHNAME_HEADER]: "https://evil.example/phish",
        [SEARCH_HEADER]: "?x=forged",
      }),
    );
    expect(response.headers.get("location")).toBe(
      `${ORIGIN}/masuk?next=%2Fbelajar%2Fgizi-dasar`,
    );
  });

  it("does not treat unrelated cookies (or the cookieCache cookie) as a session", () => {
    expect(proxy(request("/cms", { cookie: "other=1" })).status).toBe(307);
    expect(
      proxy(request("/cms", { cookie: "better-auth.session_data=cache" }))
        .status,
    ).toBe(307);
  });
});

describe("proxy — session cookie present", () => {
  it("forwards the request (no redirect) for the __Secure- cookie", () => {
    const response = proxy(
      request("/cms/pengguna?tab=1", {
        cookie: "__Secure-better-auth.session_token=tok; other=1",
      }),
    );
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("forwards the request for the plain (dev http) cookie name", () => {
    const response = proxy(
      request("/belajar", { cookie: "better-auth.session_token=tok" }),
    );
    expect(response.headers.get("location")).toBeNull();
  });

  it("OVERWRITES the path/search headers with the real URL — client values do not survive", () => {
    const response = proxy(
      request("/cms/kursus/1?edit=2", {
        cookie: "__Secure-better-auth.session_token=tok",
        [PATHNAME_HEADER]: "https://evil.example/phish",
        [SEARCH_HEADER]: "?forged=1",
      }),
    );
    const overridden = (response.headers.get(FORWARDED) ?? "").split(",");
    expect(overridden).toContain(PATHNAME_HEADER);
    expect(overridden).toContain(SEARCH_HEADER);
    expect(response.headers.get(`x-middleware-request-${PATHNAME_HEADER}`)).toBe(
      "/cms/kursus/1",
    );
    expect(response.headers.get(`x-middleware-request-${SEARCH_HEADER}`)).toBe(
      "?edit=2",
    );
  });
});

describe("proxy matcher", () => {
  it("covers exactly the signed-in areas — never /api/**", () => {
    expect(config.matcher).toEqual([
      "/belajar/:path*",
      "/profil",
      "/cms/:path*",
    ]);
  });
});
