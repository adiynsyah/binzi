// Integration tests for the consultation service over PGlite (card S6-01
// §8): the WhatsApp reader must be fail-closed on every invalid shape —
// a missing row, a JSON NUMBER where a string belongs, or an empty string
// — and only a valid string produces a URL. These pin the jsonb_typeof +
// `#>> '{}'` reading discipline (a `::text` read would pass the quoted
// string `"6280000000000"` to the pattern and fail).
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { systemSettings } from "@/db/schema";

// Same harness pattern as src/modules/quiz/service.integration.test.ts:
// "server-only" stubbed, the "@/db" singleton proxied onto the PGlite
// instance installed in beforeAll.
const dbHolder = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get(_target, prop) {
        const target = dbHolder.current as
          | Record<string | symbol, unknown>
          | undefined;
        if (!target) {
          throw new Error("@/db mock used before the PGlite instance was installed");
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === "function"
          ? (value as (...args: unknown[]) => unknown).bind(target)
          : value;
      },
    },
  ),
}));

import { WHATSAPP_TEMPLATE } from "@/components/public/beranda/beranda-content";

import {
  ConsultationUnavailableError,
  buildWhatsAppUrl,
  getConsultationWhatsAppUrl,
} from "./service";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

let pglite: PGlite;
let db: Db;

beforeAll(async () => {
  pglite = new PGlite();
  const pgliteDb = drizzle(pglite, { schema });
  await migrate(pgliteDb, {
    migrationsFolder: fileURLToPath(new URL("../../db/migrations", import.meta.url)),
  });
  db = pgliteDb as unknown as Db;
  dbHolder.current = pgliteDb;
});

/** Resets the setting to `value` (any JSON shape) or removes the row. */
async function setSetting(
  value: string | number | undefined,
): Promise<void> {
  await db.delete(systemSettings);
  if (value !== undefined) {
    await db.insert(systemSettings).values({
      key: "consultation.whatsapp_number",
      value,
    });
  }
}

describe("getConsultationWhatsAppUrl (PGlite)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("string sah → URL wa.me", async () => {
    await setSetting("6280000000000");
    await expect(getConsultationWhatsAppUrl(WHATSAPP_TEMPLATE)).resolves.toBe(
      buildWhatsAppUrl("6280000000000", WHATSAPP_TEMPLATE),
    );
  });

  it("baris hilang → error", async () => {
    await setSetting(undefined);
    await expect(getConsultationWhatsAppUrl(WHATSAPP_TEMPLATE)).rejects.toThrow(
      ConsultationUnavailableError,
    );
  });

  it("nilai JSON berupa angka → error", async () => {
    await setSetting(6280000000000);
    await expect(getConsultationWhatsAppUrl(WHATSAPP_TEMPLATE)).rejects.toThrow(
      ConsultationUnavailableError,
    );
  });

  it("string kosong → error", async () => {
    await setSetting("");
    await expect(getConsultationWhatsAppUrl(WHATSAPP_TEMPLATE)).rejects.toThrow(
      ConsultationUnavailableError,
    );
  });
});
