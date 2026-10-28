// Unit tests for the binzi-dev wrapper core (card C-05 §3). All inputs are
// fake FILE CONTENT strings — no real .env.binzi-dev is ever read here.
import { describe, expect, it } from "vitest";

import { buildChildEnv, resolveBinziDevTargets } from "./binzi-dev-target";

const POOLER_HOST = "aws-0-contoh.pooler.supabase.com";
const DUMMY_SECRET = "sandi-jangan-dicetak";

const validUrl = (port: number) =>
  `postgresql://postgres:${DUMMY_SECRET}@${POOLER_HOST}:${port}/postgres`;

const fileWith = (lines: string[]) => lines.join("\n");

describe("resolveBinziDevTargets", () => {
  it("mengurai kunci yang dibutuhkan dan memformat baris target", () => {
    const targets = resolveBinziDevTargets(
      fileWith([
        `DATABASE_URL=${validUrl(6543)}`,
        `MIGRATION_DATABASE_URL=${validUrl(5432)}`,
      ]),
      ["DATABASE_URL", "MIGRATION_DATABASE_URL"],
    );
    expect(targets.get("DATABASE_URL")?.target).toBe(
      `${POOLER_HOST}:6543/postgres`,
    );
    expect(targets.get("MIGRATION_DATABASE_URL")?.target).toBe(
      `${POOLER_HOST}:5432/postgres`,
    );
  });

  it("menolak kunci yang hilang di berkas — meski ada di env proses", () => {
    // Mutasi no. 3: jika core diubah memakai process.env sebagai cadangan,
    // pemanggilan ini TIDAK melempar dan tes merah.
    const key = "BINZI_DEV_TEST_FALLBACK_KEY";
    const original = process.env[key];
    process.env[key] = validUrl(5432);
    try {
      expect(() =>
        resolveBinziDevTargets(fileWith(["OTHER=tidak-relevan"]), [key]),
      ).toThrow(/tidak ada atau kosong/);
    } finally {
      if (original === undefined) delete process.env[key];
      else process.env[key] = original;
    }
  });

  it.each([
    ["nilai kosong (KEY=)", `DATABASE_URL=`],
    ["nilai spasi", `DATABASE_URL=   `],
  ])("menolak %s", (_label, line) => {
    expect(() =>
      resolveBinziDevTargets(fileWith([line, `MIGRATION_DATABASE_URL=${validUrl(5432)}`]), [
        "DATABASE_URL",
        "MIGRATION_DATABASE_URL",
      ]),
    ).toThrow(/DATABASE_URL tidak ada atau kosong/);
  });

  it.each([
    ["localhost", `postgresql://postgres:x@localhost:54330/binzi_local`],
    ["127.0.0.1", `postgresql://postgres:x@127.0.0.1:54330/binzi_local`],
    ["::1", `postgresql://postgres:x@[::1]:54330/binzi_e2e`],
    ["localhost tanpa port", `postgresql://postgres:x@localhost/binzi_local`],
  ])("menolak host lokal: %s", (_label, line) => {
    expect(() =>
      resolveBinziDevTargets(fileWith([`DATABASE_URL=${line}`]), [
        "DATABASE_URL",
      ]),
    ).toThrow(/menunjuk host lokal/);
  });

  it("menolak protokol selain postgres/postgresql", () => {
    expect(() =>
      resolveBinziDevTargets(
        fileWith([`DATABASE_URL=mysql://postgres:x@${POOLER_HOST}:5432/postgres`]),
        ["DATABASE_URL"],
      ),
    ).toThrow(/bukan postgres\/postgresql/);
  });

  it("menolak host kosong", () => {
    expect(() =>
      resolveBinziDevTargets(fileWith(["DATABASE_URL=postgresql:///postgres"]), [
        "DATABASE_URL",
      ]),
    ).toThrow(/tidak memuat host/);
  });

  it("menolak URL yang tidak bisa diurai", () => {
    expect(() =>
      resolveBinziDevTargets(fileWith(["DATABASE_URL=bukan url sama sekali"]), [
        "DATABASE_URL",
      ]),
    ).toThrow(/tidak bisa diurai/);
  });

  it("pesan galat tidak memuat sandi dari berkas", () => {
    try {
      resolveBinziDevTargets(
        fileWith([`DATABASE_URL=postgresql://postgres:${DUMMY_SECRET}@localhost:5432/postgres`]),
        ["DATABASE_URL"],
      );
      expect.unreachable("core harus melempar");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain(DUMMY_SECRET);
    }
  });
});

describe("buildChildEnv", () => {
  it("nilai berkas MENIMPA nilai env proses pada env anak", () => {
    // Mutasi no. 2: jika arah penggabungan dibalik, tes ini merah.
    const fileValue = validUrl(5432);
    const targets = resolveBinziDevTargets(
      fileWith([`DATABASE_URL=${fileValue}`]),
      ["DATABASE_URL"],
    );
    const childEnv = buildChildEnv(
      { DATABASE_URL: "postgresql://postgres:lama@localhost:54330/binzi_local" },
      targets,
    );
    expect(childEnv.DATABASE_URL).toBe(fileValue);
  });

  it("kunci env proses lain diwarisi apa adanya", () => {
    const targets = resolveBinziDevTargets(
      fileWith([`DATABASE_URL=${validUrl(6543)}`]),
      ["DATABASE_URL"],
    );
    const childEnv = buildChildEnv(
      { DATABASE_URL: "nilai-lama", PATH: "/usr/bin" },
      targets,
    );
    expect(childEnv.PATH).toBe("/usr/bin");
  });
});
