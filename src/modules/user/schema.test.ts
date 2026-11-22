// Proves the input contracts are strict (A-08): privileged keys (role,
// status, email) and image are rejected instead of silently stripped, and
// pagination input is bounded.
import { describe, expect, it } from "vitest";

import { getUserInput, listUsersInput, updateNameInput, updateProfileInput } from "./schema";

const validUserId = { userId: "usr_123" };

describe("getUserInput", () => {
  it("accepts a non-empty id and rejects an empty one", () => {
    expect(getUserInput.parse(validUserId)).toEqual(validUserId);
    expect(getUserInput.safeParse({ userId: "" }).success).toBe(false);
  });
});

describe("updateProfileInput", () => {
  const valid = { ...validUserId, name: "Sinta Contoh" };

  it("accepts name with optional phone", () => {
    expect(updateProfileInput.parse(valid)).toEqual({
      ...valid,
      phone: undefined,
    });
    expect(
      updateProfileInput.parse({ ...valid, phone: "+62812345678" }),
    ).toEqual({ ...valid, phone: "+62812345678" });
    expect(updateProfileInput.parse({ ...valid, phone: null })).toEqual({
      ...valid,
      phone: null,
    });
  });

  it("rejects an invalid phone and a blank name", () => {
    expect(
      updateProfileInput.safeParse({ ...valid, phone: "ABC-SECRET" }).success,
    ).toBe(false);
    expect(
      updateProfileInput.safeParse({ ...valid, name: "   " }).success,
    ).toBe(false);
  });

  it("allows up to 128 name characters, rejects 129 (card S5-05)", () => {
    // The shared name field moved 100 → 128 with the /profil form; the old
    // bound is pinned here so a silent revert cannot pass.
    expect(
      updateProfileInput.parse({ ...valid, name: "a".repeat(128) }).name,
    ).toBe("a".repeat(128));
    expect(
      updateProfileInput.safeParse({ ...valid, name: "a".repeat(129) })
        .success,
    ).toBe(false);
  });

  it("rejects privileged and uncontracted keys (strict)", () => {
    for (const extra of [
      { role: "ADMIN" },
      { status: "SUSPENDED" },
      { email: "hacker@example.test" },
      { image: "https://evil.test/x.png" },
    ]) {
      const result = updateProfileInput.safeParse({ ...valid, ...extra });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.code === "unrecognized_keys"))
          .toBe(true);
      }
    }
  });
});

describe("updateNameInput (card S5-05)", () => {
  it("trims and accepts a 1–128 character name", () => {
    expect(updateNameInput.parse({ name: "  Sinta Contoh  " })).toEqual({
      name: "Sinta Contoh",
    });
    expect(updateNameInput.parse({ name: "a".repeat(128) })).toEqual({
      name: "a".repeat(128),
    });
  });

  it("rejects blank, 129-character, and missing names", () => {
    expect(updateNameInput.safeParse({ name: "" }).success).toBe(false);
    expect(updateNameInput.safeParse({ name: "   " }).success).toBe(false);
    expect(
      updateNameInput.safeParse({ name: "a".repeat(129) }).success,
    ).toBe(false);
    expect(updateNameInput.safeParse({}).success).toBe(false);
  });

  it("rejects every other key — there is no userId to choose (strict)", () => {
    // The /profil route writes to the SESSION user's id; a payload carrying
    // userId (someone else's), phone, or any privileged key is rejected,
    // never silently stripped.
    for (const extra of [
      { userId: "usr_lain" },
      { phone: "+62812345678" },
      { role: "ADMIN" },
      { email: "hacker@example.test" },
      { image: "https://evil.test/x.png" },
    ]) {
      const result = updateNameInput.safeParse({
        name: "Sinta Contoh",
        ...extra,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.code === "unrecognized_keys"),
        ).toBe(true);
      }
    }
  });
});

describe("listUsersInput", () => {
  it("defaults to page 1 and coerces numeric strings", () => {
    expect(listUsersInput.parse({})).toEqual({ page: 1 });
    expect(listUsersInput.parse({ page: "3" })).toEqual({ page: 3 });
  });

  it("rejects non-positive pages and extra keys", () => {
    expect(listUsersInput.safeParse({ page: 0 }).success).toBe(false);
    expect(
      listUsersInput.safeParse({ page: 1, pageSize: 9999 }).success,
    ).toBe(false);
  });
});
