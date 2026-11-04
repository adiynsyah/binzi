// slugify + uniquifySlug (card S1-02 §4 step 3, review addition 7): the
// lesson slug gets the same title→slug rule the course contract owns, plus
// a suffix loop that keeps suffixed slugs within SLUG_MAX.
import { describe, expect, it } from "vitest";

import { SLUG_MAX, slugify, uniquifySlug } from "./slug";

describe("slugify", () => {
  it("diacritics, punctuation and case collapse to a clean slug", () => {
    expect(slugify("Gizi Seimbang: Trimester Ketiga!")).toBe(
      "gizi-seimbang-trimester-ketiga",
    );
    expect(slugify("  --Menyiasati   Rasa Begah--  ")).toBe(
      "menyiasati-rasa-begah",
    );
  });

  it("cuts at maxLength and trims the trailing dash the cut produced", () => {
    expect(slugify("a".repeat(90), 10)).toBe("a".repeat(10));
    expect(slugify("abcdefghij klm", 10)).toBe("abcdefghij");
  });

  it("punctuation-only titles yield the empty string", () => {
    expect(slugify("!!! ???")).toBe("");
  });
});

describe("uniquifySlug", () => {
  it("returns the base when nothing is taken", () => {
    expect(uniquifySlug("materi", () => false)).toBe("materi");
  });

  it("appends -2, -3, … past the first collision", () => {
    const taken = new Set(["materi", "materi-2"]);
    expect(uniquifySlug("materi", (s) => taken.has(s))).toBe("materi-3");
  });

  it("reserved words count as taken when passed through the predicate", () => {
    expect(uniquifySlug("final-quiz", (s) => s === "final-quiz")).toBe(
      "final-quiz-2",
    );
  });

  it("two identical 80-char bases: the second ends in -2 and stays <= 80", () => {
    const base = "k".repeat(SLUG_MAX);
    const taken = new Set([base]);
    const second = uniquifySlug(base, (s) => taken.has(s));
    expect(second).toBe(`${"k".repeat(SLUG_MAX - 2)}-2`);
    expect(second.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(second.endsWith("-2")).toBe(true);
  });

  it("a base whose cut leaves a trailing dash still appends the suffix cleanly", () => {
    // 80 chars ending in "-" before the suffix: the dash is trimmed first.
    const base = `${"k".repeat(79)}-`;
    expect(uniquifySlug(base, () => false)).toBe(`${"k".repeat(79)}`);
    const taken = new Set([base, "k".repeat(79)]);
    expect(uniquifySlug(base, (s) => taken.has(s))).toBe(
      `${"k".repeat(78)}-2`,
    );
  });
});
