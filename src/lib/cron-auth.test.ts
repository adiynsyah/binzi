// isCronSecretValid (card A-18 §2): the fail-closed and constant-time
// comparison rules. Fixture values only — never a real secret.
import { describe, expect, it } from "vitest";

import { isCronSecretValid } from "./cron-auth";

const SECRET = "fixture-cron-secret-0123456789abcdef";

describe("isCronSecretValid", () => {
  it("accepts the matching header", () => {
    expect(isCronSecretValid(SECRET, SECRET)).toBe(true);
  });

  it("rejects a wrong header", () => {
    expect(isCronSecretValid(SECRET, "a-completely-different-value")).toBe(
      false,
    );
  });

  it("rejects a header of different length (prefix of the secret)", () => {
    expect(isCronSecretValid(SECRET, SECRET.slice(0, 8))).toBe(false);
  });

  it("rejects a same-length header that differs only in the last character", () => {
    const sameLength = `${SECRET.slice(0, -1)}X`;
    // Preconditions, so this can never silently degrade into a
    // different-length case.
    expect(sameLength).toHaveLength(SECRET.length);
    expect(sameLength).not.toBe(SECRET);
    expect(isCronSecretValid(SECRET, sameLength)).toBe(false);
  });

  it("rejects an empty header", () => {
    expect(isCronSecretValid(SECRET, "")).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(isCronSecretValid(SECRET, null)).toBe(false);
  });

  it("rejects everything when the server secret is empty — including an empty header", () => {
    expect(isCronSecretValid("", SECRET)).toBe(false);
    expect(isCronSecretValid("", "")).toBe(false);
    expect(isCronSecretValid("", null)).toBe(false);
  });

  it("rejects everything when the server secret is undefined", () => {
    expect(isCronSecretValid(undefined, SECRET)).toBe(false);
    expect(isCronSecretValid(undefined, "")).toBe(false);
    expect(isCronSecretValid(undefined, null)).toBe(false);
  });
});
