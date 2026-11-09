// Unit tests for the pure consultation helpers (card S6-01 §8): the exact
// wa.me URL (KSL-03/04) and the number pattern (KSL-08). The DB path is
// covered by service.integration.test.ts.
import { describe, expect, it, vi } from "vitest";

// The service imports "server-only" and ./queries (which pulls in @/db →
// env validation); the unit test only exercises the pure helpers, so both
// are stubbed. The DB path is covered by service.integration.test.ts.
vi.mock("server-only", () => ({}));
vi.mock("./queries", () => ({
  WHATSAPP_NUMBER_KEY: "consultation.whatsapp_number",
  selectWhatsappNumberRaw: vi.fn(),
}));

import { WHATSAPP_TEMPLATE } from "@/components/public/beranda/beranda-content";

import { buildWhatsAppUrl, isValidWhatsAppNumber } from "./service";

const EXPECTED_URL =
  "https://wa.me/6280000000000?text=Halo%2C%20saya%20___%20dan%20ingin%20bertanya%20seputar%20gizi.%20Saya%20menemukan%20halaman%20ini%20dari%20BINZI.";

describe("buildWhatsAppUrl", () => {
  it("builds the exact wa.me URL for the seeded number and template", () => {
    expect(buildWhatsAppUrl("6280000000000", WHATSAPP_TEMPLATE)).toBe(
      EXPECTED_URL,
    );
  });
});

describe("isValidWhatsAppNumber", () => {
  it.each(["6280000000000", "628123456789"])("menerima %s", (value) => {
    expect(isValidWhatsAppNumber(value)).toBe(true);
  });

  it.each([
    ["0812345678", "tidak diawali 62"],
    ["+6281234567", "memakai plus"],
    ["62", "terlalu pendek"],
    ["6281234567890123", "16 digit (terlalu panjang)"],
    ["", "string kosong"],
  ])("menolak %s (%s)", (value) => {
    expect(isValidWhatsAppNumber(value)).toBe(false);
  });
});
