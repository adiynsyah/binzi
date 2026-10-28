// Unit tests for the local-DB guard + target formatter (card C-05).
// The guard is a pure function: every rejection happens BEFORE any DB
// connection exists — these tests are the "tolak sebelum koneksi" proof.
import { describe, expect, it } from "vitest";

import {
  assertLocalDemoDatabaseUrl,
  formatDatabaseTarget,
} from "./local-guard";

const DUMMY_SECRET = "sandi-jangan-dicetak";

describe("assertLocalDemoDatabaseUrl", () => {
  it.each([
    "postgresql://postgres:postgres@localhost:54330/binzi_local",
    "postgresql://postgres:postgres@127.0.0.1:54330/binzi_local",
    "postgres://postgres:postgres@[::1]:54329/binzi_e2e",
    "postgres://postgres:postgres@localhost/binzi_e2e", // default port
  ])("menerima %s", (url) => {
    expect(assertLocalDemoDatabaseUrl(url)).toBe(url);
  });

  it.each([
    ["URL kosong (undefined)", undefined],
    ["URL kosong (string kosong)", ""],
    ["URL kosong (spasi)", "   "],
    [
      "host Supabase",
      `postgresql://postgres:${DUMMY_SECRET}@contoh.pooler.supabase.com:5432/binzi_local`,
    ],
    [
      "nama database lain (binzi_dev)",
      "postgresql://postgres:postgres@localhost:54330/binzi_dev",
    ],
    [
      "nama database lain (postgres)",
      "postgresql://postgres:postgres@127.0.0.1:54330/postgres",
    ],
    [
      "protokol salah",
      `mysql://postgres:${DUMMY_SECRET}@localhost:54330/binzi_local`,
    ],
    [
      "multi-host",
      "postgresql://postgres:postgres@localhost:54330,contoh.supabase.com:5432/binzi_local",
    ],
    ["URL rusak", "bukan-url"],
  ])("menolak: %s", (_label, url) => {
    expect(() => assertLocalDemoDatabaseUrl(url)).toThrow(
      /URL database demo ditolak/,
    );
  });

  it("pesan galat tidak memuat user maupun sandi dari URL", () => {
    try {
      assertLocalDemoDatabaseUrl(
        `postgresql://pengguna:${DUMMY_SECRET}@contoh.pooler.supabase.com:5432/binzi_local`,
      );
      expect.unreachable("guard harus melempar");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain(DUMMY_SECRET);
      expect(message).not.toContain("pengguna");
    }
  });
});

describe("formatDatabaseTarget", () => {
  it("menampilkan host:port/nama-db tanpa user dan sandi", () => {
    const target = formatDatabaseTarget(
      "postgresql://postgres:sandi@localhost:54330/binzi_local",
    );
    expect(target).toBe("localhost:54330/binzi_local");
    expect(target).not.toContain("sandi");
  });

  it("port kosong ditampilkan sebagai 5432", () => {
    expect(
      formatDatabaseTarget("postgresql://u:p@db.example.com:6543/x"),
    ).toBe("db.example.com:6543/x");
    expect(formatDatabaseTarget("postgresql://u:p@db.example.com/y")).toBe(
      "db.example.com:5432/y",
    );
  });

  it("host IPv6 ditulis tanpa kurung siku", () => {
    expect(formatDatabaseTarget("postgresql://u:p@[::1]:54330/binzi_e2e")).toBe(
      "::1:54330/binzi_e2e",
    );
  });

  it("URL yang tak bisa diurai menghasilkan teks tetap tanpa isi URL", () => {
    const target = formatDatabaseTarget("bukan url sama sekali");
    expect(target).toBe("[URL tidak bisa diurai — isinya tidak dicetak]");
  });
});
