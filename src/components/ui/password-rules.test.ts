import { describe, expect, it } from "vitest";
import {
  passwordRules,
  satisfiedPasswordRules,
} from "./password-rules";

describe("passwordRules", () => {
  it("uses the final copy from screen 3a", () => {
    expect(passwordRules.map((rule) => rule.label)).toEqual([
      "8 karakter",
      "ada huruf",
      "ada angka",
    ]);
  });

  it("keeps declaration order in satisfiedPasswordRules", () => {
    expect(
      satisfiedPasswordRules("a1b2c3d4e").map((rule) => rule.id),
    ).toEqual(["length", "letter", "digit"]);
    expect(satisfiedPasswordRules("abcdefg").map((rule) => rule.id)).toEqual([
      "letter",
    ]);
    expect(satisfiedPasswordRules("12345678").map((rule) => rule.id)).toEqual([
      "length",
      "digit",
    ]);
    expect(satisfiedPasswordRules("")).toEqual([]);
  });
});
