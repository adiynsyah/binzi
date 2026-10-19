// Guard unit tests — no browser involved (card A-19 "Selesai jika").
// The expectations are the fail-closed contract: only a LOCAL host with the
// database name EXACTLY binzi_e2e is accepted; everything else — including
// the Supabase pooler, other local databases, malformed URLs, empty values
// and multi-host connection strings — is rejected.
import { expect, test } from "@playwright/test";

import { assertE2eDatabaseUrl } from "./db-guard";

const GOOD = "postgresql://postgres:postgres@127.0.0.1:54329/binzi_e2e";

test.describe("assertE2eDatabaseUrl", () => {
  test("accepts localhost, 127.0.0.1 and [::1] with binzi_e2e", () => {
    expect(assertE2eDatabaseUrl(GOOD)).toBe(GOOD);
    expect(
      assertE2eDatabaseUrl("postgresql://postgres:postgres@localhost:54329/binzi_e2e"),
    ).toBe("postgresql://postgres:postgres@localhost:54329/binzi_e2e");
    expect(
      assertE2eDatabaseUrl("postgresql://postgres:postgres@[::1]:54329/binzi_e2e"),
    ).toBe("postgresql://postgres:postgres@[::1]:54329/binzi_e2e");
  });

  test("accepts the postgres:// scheme and query parameters", () => {
    expect(
      assertE2eDatabaseUrl("postgres://postgres:postgres@localhost:54329/binzi_e2e"),
    ).toBe("postgres://postgres:postgres@localhost:54329/binzi_e2e");
    expect(
      assertE2eDatabaseUrl(`${GOOD}?sslmode=disable`),
    ).toBe(`${GOOD}?sslmode=disable`);
  });

  test("rejects the Supabase pooler host (binzi-dev!)", () => {
    expect(() =>
      assertE2eDatabaseUrl(
        "postgresql://postgres.abc123:hunter2@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
      ),
    ).toThrowError(/not local/);
  });

  test("rejects a non-local host even with the exact binzi_e2e database", () => {
    // Isolates the HOST rule: with the right database name, only the
    // local-host check can (and must) reject this URL.
    expect(() =>
      assertE2eDatabaseUrl(
        "postgresql://postgres:postgres@aws-0-ap-southeast-1.pooler.supabase.com:6543/binzi_e2e",
      ),
    ).toThrowError(/not local/);
    expect(() =>
      assertE2eDatabaseUrl(
        "postgresql://postgres:postgres@evil.example.com:5432/binzi_e2e",
      ),
    ).toThrowError(/not local/);
  });

  test("rejects a local host with any other database name", () => {
    expect(() =>
      assertE2eDatabaseUrl("postgresql://postgres:postgres@127.0.0.1:54329/binzi_dev"),
    ).toThrowError(/binzi_e2e/);
  });

  test("rejects invalid URLs, non-postgres schemes, empty and missing values", () => {
    expect(() => assertE2eDatabaseUrl("not a url")).toThrowError(/not a valid URL/);
    expect(() => assertE2eDatabaseUrl("postgresql://")).toThrowError();
    expect(() =>
      assertE2eDatabaseUrl("https://localhost:54329/binzi_e2e"),
    ).toThrowError(/postgres/);
    expect(() => assertE2eDatabaseUrl("")).toThrowError(/empty/);
    expect(() => assertE2eDatabaseUrl("   ")).toThrowError(/empty/);
    expect(() => assertE2eDatabaseUrl(undefined)).toThrowError(/empty/);
  });

  test("rejects the multi-host form postgres-js would accept", () => {
    // new URL() fails on it → parse failure → reject (the safe direction:
    // a pooler host in the list must never reach the harness).
    expect(() =>
      assertE2eDatabaseUrl(
        "postgresql://u:p@127.0.0.1:54329,evil.example.com:6543/binzi_e2e",
      ),
    ).toThrowError(/not a valid URL/);
  });

  test("never echoes the URL or its password in the rejection message", () => {
    const secret = "hunter2-secret";
    let message = "";
    try {
      assertE2eDatabaseUrl(
        `postgresql://postgres:${secret}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
      );
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).not.toContain(secret);
    expect(message).not.toContain("postgresql://");
  });
});
