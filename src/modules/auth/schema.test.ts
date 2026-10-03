// Contract tests for the AUTH-01 password policy and input schemas.
import { describe, expect, it } from "vitest";

import {
  PASSWORD_MIN_LENGTH,
  normalizeEmail,
  passwordSchema,
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
