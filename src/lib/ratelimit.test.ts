// Pure tests for client-IP extraction/normalization used in rate-limit keys
// (AUTH-08). No database — the upsert/window logic is covered by the
// integration test in src/modules/auth/better-auth.integration.test.ts.
import { describe, expect, it } from "vitest";

import {
  extractClientIp,
  loginRateLimitKey,
  normalizeClientIp,
  signUpRateLimitKey,
} from "./ratelimit";

function headersWith(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe("extractClientIp", () => {
  it("takes the leftmost x-forwarded-for entry (Vercel overwrites the header at the edge)", () => {
    expect(
      extractClientIp(headersWith({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })),
    ).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip when forwarded-for is absent or invalid", () => {
    expect(extractClientIp(headersWith({ "x-real-ip": "198.51.100.4" }))).toBe(
      "198.51.100.4",
    );
    expect(
      extractClientIp(headersWith({ "x-forwarded-for": "bukan-ip", "x-real-ip": "198.51.100.4" })),
    ).toBe("198.51.100.4");
  });

  it("returns 'unknown' when nothing validates", () => {
    expect(extractClientIp(undefined)).toBe("unknown");
    expect(extractClientIp(headersWith({}))).toBe("unknown");
    expect(extractClientIp(headersWith({ "x-forwarded-for": "spoofed" }))).toBe(
      "unknown",
    );
  });
});

describe("normalizeClientIp", () => {
  it("collapses IPv4-mapped IPv6 to the IPv4 form", () => {
    expect(normalizeClientIp("::ffff:203.0.113.5")).toBe("203.0.113.5");
  });

  it("masks IPv6 to its /64 so rotating hosts share one bucket", () => {
    expect(normalizeClientIp("2001:db8:1:2:3:4:5:6")).toBe("2001:0db8:0001:0002::/64");
    expect(normalizeClientIp("2001:db8:1:2:dead:beef:dead:beef")).toBe(
      "2001:0db8:0001:0002::/64",
    );
  });

  it("expands compressed IPv6 before masking", () => {
    expect(normalizeClientIp("2001:db8::9")).toBe("2001:0db8:0000:0000::/64");
  });

  it("passes IPv4 through untouched", () => {
    expect(normalizeClientIp("203.0.113.7")).toBe("203.0.113.7");
  });
});

describe("bucket keys", () => {
  it("normalize the email so case/whitespace variants share one bucket", () => {
    expect(loginRateLimitKey("203.0.113.7", "  Rina@Example.COM ")).toBe(
      "login:203.0.113.7:rina@example.com",
    );
    expect(signUpRateLimitKey("203.0.113.7", "Rina@Example.com")).toBe(
      "signup:203.0.113.7:rina@example.com",
    );
  });

  it("keeps login and signup buckets separate", () => {
    expect(loginRateLimitKey("203.0.113.7", "a@b.c")).not.toBe(
      signUpRateLimitKey("203.0.113.7", "a@b.c"),
    );
  });
});
