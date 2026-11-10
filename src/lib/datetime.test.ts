import { describe, expect, it } from "vitest";

import { formatWib } from "./datetime";

// Pinned instants (UTC input → WIB = UTC+7 output). The exact strings keep
// the formatter honest about id-ID month abbreviations, "numeric" days
// (no leading zero), 2-digit 24-hour clock with "." separator, and the
// date shift when UTC evening rolls past midnight in Jakarta.
describe("formatWib", () => {
  it("formats a UTC instant as tanggal, jam, dan WIB", () => {
    expect(formatWib(new Date("2026-09-19T02:14:00Z"))).toBe(
      "19 Sep 2026 09.14 WIB",
    );
  });

  it("shifts to the next calendar day when UTC evening passes midnight WIB", () => {
    expect(formatWib(new Date("2026-10-28T17:05:00Z"))).toBe(
      "29 Okt 2026 00.05 WIB",
    );
  });

  it("keeps single-digit days unpadded and minutes zero-padded", () => {
    expect(formatWib(new Date("2026-01-05T03:01:00Z"))).toBe(
      "5 Jan 2026 10.01 WIB",
    );
  });
});
