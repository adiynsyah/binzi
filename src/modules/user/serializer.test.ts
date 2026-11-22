// Proves sensitive users columns never leave the module (A-08, V-01/V-05):
// - toUserPrivateDTO exposes exactly its 10-field allowlist — deletedAt and
//   any unknown key are dropped even when present in the input row.
// - toPublicUserDTO exposes only id/name/image — email, phone, role, status,
//   lastLoginAt, emailVerified, deletedAt must never appear.
// - toAccountSecurityDTO (card S5-05) exposes exactly its 3-field summary —
//   provider rows go in, only the three booleans/count come out.
import { describe, expect, it } from "vitest";

import type { AccountSecurityRow, UserRow } from "./serializer";
import {
  toAccountSecurityDTO,
  toPublicUserDTO,
  toUserPrivateDTO,
} from "./serializer";

const baseRow: UserRow = {
  id: "usr_123",
  name: "Sinta Contoh",
  email: "sinta@example.test",
  emailVerified: true,
  image: "https://example.test/avatar.png",
  phone: "+62812345678",
  role: "MEMBER",
  status: "ACTIVE",
  lastLoginAt: new Date("2026-10-01T08:00:00.000Z"),
  createdAt: new Date("2026-09-01T08:00:00.000Z"),
};

// A full physical row: every users column, deletedAt included, plus an
// unknown key as a stand-in for any future column addition.
const fullRow: UserRow & {
  updatedAt: Date;
  deletedAt: Date;
  someFutureColumn: string;
} = {
  ...baseRow,
  updatedAt: new Date("2026-10-02T00:00:00.000Z"),
  deletedAt: new Date("2026-10-02T00:00:00.000Z"),
  someFutureColumn: "should never serialize",
};

describe("toUserPrivateDTO", () => {
  it("returns exactly the private allowlist", () => {
    const dto = toUserPrivateDTO(fullRow);
    expect(Object.keys(dto).sort()).toEqual(
      [
        "createdAt",
        "email",
        "emailVerified",
        "id",
        "image",
        "lastLoginAt",
        "name",
        "phone",
        "role",
        "status",
      ].sort(),
    );
    expect(dto).toMatchObject({
      id: "usr_123",
      name: "Sinta Contoh",
      email: "sinta@example.test",
      role: "MEMBER",
      status: "ACTIVE",
    });
  });

  it("is JSON-safe: dates leave as ISO strings, null stays null", () => {
    const dto = toUserPrivateDTO(fullRow);
    expect(dto.createdAt).toBe("2026-09-01T08:00:00.000Z");
    expect(dto.lastLoginAt).toBe("2026-10-01T08:00:00.000Z");

    const neverLoggedIn = toUserPrivateDTO({
      ...baseRow,
      lastLoginAt: null,
    });
    expect(neverLoggedIn.lastLoginAt).toBeNull();

    // No Date instance may survive serialization (runtime proof on top of
    // the DTO type, which no longer admits Date at all).
    for (const value of Object.values(dto) as unknown[]) {
      expect(value instanceof Date).toBe(false);
    }
  });

  it("never serializes deletedAt or unknown keys", () => {
    const dto = toUserPrivateDTO(fullRow);
    expect(fullRow.deletedAt).toBeInstanceOf(Date); // sanity: input has it
    expect("deletedAt" in dto).toBe(false);
    expect("updatedAt" in dto).toBe(false);
    expect(JSON.stringify(dto)).not.toContain("someFutureColumn");
    expect(JSON.stringify(dto)).not.toContain("2026-10-02");
  });
});

describe("toPublicUserDTO", () => {
  it("returns exactly id, name, image", () => {
    const dto = toPublicUserDTO(fullRow);
    expect(Object.keys(dto).sort()).toEqual(["id", "image", "name"]);
    expect(dto).toEqual({
      id: "usr_123",
      name: "Sinta Contoh",
      image: "https://example.test/avatar.png",
    });
  });

  it("never exposes private or sensitive fields", () => {
    const dto = toPublicUserDTO(fullRow);
    const forbidden = [
      "email",
      "emailVerified",
      "phone",
      "role",
      "status",
      "lastLoginAt",
      "deletedAt",
      "updatedAt",
    ] as const;

    for (const field of forbidden) {
      expect(field in dto).toBe(false);
    }
    expect(JSON.stringify(dto)).not.toContain("sinta@example.test");
    expect(JSON.stringify(dto)).not.toContain("+62812345678");
  });
});

describe("toAccountSecurityDTO (card S5-05)", () => {
  it("returns exactly hasPassword, googleLinked, activeSessionCount", () => {
    const row: AccountSecurityRow = {
      providers: [
        { providerId: "credential", hasPassword: true },
        { providerId: "google", hasPassword: false },
      ],
      activeSessionCount: 2,
    };
    const dto = toAccountSecurityDTO(row);
    expect(Object.keys(dto).sort()).toEqual([
      "activeSessionCount",
      "googleLinked",
      "hasPassword",
    ]);
    expect(dto).toEqual({
      hasPassword: true,
      googleLinked: true,
      activeSessionCount: 2,
    });
  });

  it("keeps hasPassword false for a null-password credential row", () => {
    // A credential row whose password is null is NOT a set password
    // (Google-only account that never created one): the SQL side computes
    // "password is not null", the DTO side demands BOTH.
    const dto = toAccountSecurityDTO({
      providers: [{ providerId: "credential", hasPassword: false }],
      activeSessionCount: 0,
    });
    expect(dto).toEqual({
      hasPassword: false,
      googleLinked: false,
      activeSessionCount: 0,
    });
  });

  it("reads googleLinked from the google provider only — credential alone stays false", () => {
    const dto = toAccountSecurityDTO({
      providers: [{ providerId: "credential", hasPassword: true }],
      activeSessionCount: 1,
    });
    expect(dto.googleLinked).toBe(false);
  });
});
