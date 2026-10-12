import { describe, expect, it } from "vitest";
import { displayNameOf, firstNameOf } from "./member-user";

describe("displayNameOf", () => {
  it("keeps a real name as the display name", () => {
    expect(
      displayNameOf({ name: "Rina Kurnia", email: "rina@example.com" }),
    ).toBe("Rina Kurnia");
  });

  it("substitutes the email when the name is blank", () => {
    expect(displayNameOf({ name: "", email: "rina@example.com" })).toBe(
      "rina@example.com",
    );
  });

  it("treats a whitespace-only name as blank", () => {
    expect(displayNameOf({ name: "   ", email: "rina@example.com" })).toBe(
      "rina@example.com",
    );
  });
});

describe("firstNameOf", () => {
  it("takes the first word of the name", () => {
    expect(firstNameOf("Dimas Arya Pratama")).toBe("Dimas");
  });

  it("trims surrounding whitespace first", () => {
    expect(firstNameOf("  Rina ")).toBe("Rina");
  });

  it("keeps a single-word name intact", () => {
    expect(firstNameOf("Rina")).toBe("Rina");
  });

  it("returns an empty string for a blank name", () => {
    expect(firstNameOf("   ")).toBe("");
    expect(firstNameOf("")).toBe("");
  });
});
