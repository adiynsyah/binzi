// Contract tests for the AUTH-01 password policy and input schemas, and the
// A-11 internal-redirect validator.
import { describe, expect, it } from "vitest";

import {
  INTERNAL_REDIRECT_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  normalizeEmail,
  passwordSchema,
  safeInternalRedirectPath,
  signInSchema,
  signUpSchema,
} from "./schema";

describe("passwordSchema (AUTH-01)", () => {
  it.each([
    ["Gizi1234", true],
    ["passw0rd", true],
    ["ABCDEFGH1", true], // digits alone satisfy "angka"; letters present
    ["abcdefgh", false], // no digit
    ["12345678", false], // no letter
    ["G1zi", false], // too short
    ["", false],
  ])("password %j → valid=%s", (password, expected) => {
    expect(passwordSchema.safeParse(password).success).toBe(expected);
  });

  it("reports the minimum length in Indonesian", () => {
    const result = passwordSchema.safeParse("G1zi");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter`,
    );
  });

  it("reports the letter and digit rules separately", () => {
    const noDigit = passwordSchema.safeParse("abcdefgh");
    expect(noDigit.error?.issues[0]?.message).toBe(
      "Kata sandi harus mengandung angka",
    );

    const noLetter = passwordSchema.safeParse("12345678");
    expect(noLetter.error?.issues[0]?.message).toBe(
      "Kata sandi harus mengandung huruf",
    );
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Rina@Example.COM ")).toBe("rina@example.com");
  });
});

describe("safeInternalRedirectPath (A-11, open-redirect)", () => {
  it.each([
    "/",
    "/masuk",
    "/materi/2",
    "/materi/2?tab=1",
    "/konsultasi#tanya-ahli-gizi",
    "/a/b?next=%2Fmateri", // encoded value INSIDE a query is plain data
  ])("accepts internal path %j", (value) => {
    expect(safeInternalRedirectPath(value)).toBe(value);
  });

  it.each([
    ["https://evil.com/x"], // absolute — external
    ["https://binzi.example.com/materi/2"], // absolute — even our own origin
    ["http://localhost:3000/materi"],
    ["//evil.com"], // protocol-relative
    ["/\\evil.com"], // backslash after slash
    ["/\\/evil.com"],
    ["javascript:alert(1)"], // scheme
    ["javascript:/x"],
    ["data:text/html,x"],
    ["%2F%2Fevil.com"], // encoded, no leading slash
    ["/%2F%2Fevil.com"], // encoded separators after a slash
    ["/materi/%2F%2Fevil.com"],
    ["/%5C%2Fevil.com"],
    ["materi/2"], // relative path, no leading slash
    [""], // empty
    ["   "],
    ["/materi\t/2"], // control character (embedded tab survives the trim)
    ["/materi/2\u007f"],
  ])("rejects %j", (value) => {
    expect(safeInternalRedirectPath(value)).toBeNull();
  });

  it("rejects non-strings", () => {
    expect(safeInternalRedirectPath(undefined)).toBeNull();
    expect(safeInternalRedirectPath(null)).toBeNull();
    expect(safeInternalRedirectPath(42)).toBeNull();
    expect(safeInternalRedirectPath({ path: "/materi" })).toBeNull();
  });

  it("rejects values longer than the maximum", () => {
    expect(safeInternalRedirectPath("/" + "a".repeat(INTERNAL_REDIRECT_MAX_LENGTH))).toBeNull();
    expect(
      safeInternalRedirectPath("/" + "a".repeat(INTERNAL_REDIRECT_MAX_LENGTH - 1)),
    ).toBe("/" + "a".repeat(INTERNAL_REDIRECT_MAX_LENGTH - 1));
  });

  it("trims surrounding whitespace", () => {
    expect(safeInternalRedirectPath("  /materi/2  ")).toBe("/materi/2");
    // A trailing tab is trimmed too — safe normalization, not a smuggled char.
    expect(safeInternalRedirectPath("/materi/2\t")).toBe("/materi/2");
  });
});

describe("signInSchema / signUpSchema", () => {
  it("rejects an invalid email", () => {
    expect(signInSchema.safeParse({ email: "bukan-email", password: "Gizi1234" }).success).toBe(false);
    expect(signUpSchema.safeParse({ name: "Rina", email: "bukan-email", password: "Gizi1234" }).success).toBe(false);
  });

  it("rejects a password that fails the policy", () => {
    expect(
      signUpSchema.safeParse({ name: "Rina", email: "rina@example.com", password: "tanpaangka" }).success,
    ).toBe(false);
  });

  it("accepts valid payloads", () => {
    expect(
      signInSchema.safeParse({ email: "rina@example.com", password: "Gizi1234" }).success,
    ).toBe(true);
    expect(
      signUpSchema.safeParse({ name: "Rina", email: "rina@example.com", password: "Gizi1234" }).success,
    ).toBe(true);
  });
});
