// Pins every email color to the web token of the same name (card A-10).
//
// src/emails/tokens.ts is exempted from scripts/check-hex.mjs because email
// HTML needs literal values — this test is the compensating control: when a
// token changes in src/styles/tokens.css, the email palette must be updated
// in the same commit or this suite fails.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { EMAIL_TOKENS } from "./tokens";

const tokensCssPath = fileURLToPath(
  new URL("../styles/tokens.css", import.meta.url),
);

/** CSS variable color declarations from the web token source. */
function webTokenColors(): Map<string, string> {
  const css = readFileSync(tokensCssPath, "utf8");
  const colors = new Map<string, string>();
  for (const match of css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    colors.set(match[1]!, match[2]!.toLowerCase());
  }
  return colors;
}

describe("email token parity with src/styles/tokens.css", () => {
  it("every email token exists under the same name with the same value", () => {
    const web = webTokenColors();
    expect(Object.keys(EMAIL_TOKENS).length).toBeGreaterThan(0);
    for (const [name, value] of Object.entries(EMAIL_TOKENS)) {
      expect(web.has(name), `token "${name}" missing from tokens.css`).toBe(
        true,
      );
      expect(value.toLowerCase(), `token "${name}" drifted`).toBe(
        web.get(name),
      );
    }
  });
});
