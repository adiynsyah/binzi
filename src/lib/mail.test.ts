// Unit tests for pure helpers in src/lib/mail.ts (card A-10). The
// transports themselves are exercised only through the config plumbing —
// "resend" talks to the network and "log" prints; neither is unit-tested.
import { describe, expect, it } from "vitest";

import { describeError, maskEmail } from "./mail";

describe("maskEmail", () => {
  it("keeps the first character and the domain only", () => {
    expect(maskEmail("rina.kurnia@email.com")).toBe("r***@email.com");
    expect(maskEmail("adi@example.id")).toBe("a***@example.id");
  });

  it("degrades to *** for malformed input", () => {
    expect(maskEmail("")).toBe("***");
    expect(maskEmail("tanpa-apa-apa")).toBe("***");
    expect(maskEmail("@domain.com")).toBe("***");
    expect(maskEmail("user@")).toBe("***");
  });
});

describe("describeError", () => {
  it("names the error and truncates long values", () => {
    expect(describeError(new Error("boom"))).toBe("Error: boom");
    expect(describeError("teks")).toBe("teks");
    expect(describeError(new Error("x".repeat(500)))).toHaveLength(300);
  });
});
