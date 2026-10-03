// Proves the domain-error → HTTP mapping, including:
// - 404 (not owned / missing) vs 403 (role not enough) stay distinct,
// - ZodError → 400 with field paths but never input values,
// - unknown errors → generic 500 without internal details.
import { z, ZodError } from "zod";
import { describe, expect, it } from "vitest";

import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  isAppError,
  toErrorResponse,
} from "./errors";

describe("error classes", () => {
  it("carries the documented status per class", () => {
    expect(new BadRequestError()).toMatchObject({ status: 400, code: "BAD_REQUEST" });
    expect(new UnauthorizedError()).toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    expect(new ForbiddenError()).toMatchObject({ status: 403, code: "FORBIDDEN" });
    expect(new NotFoundError()).toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect(new ConflictError()).toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("is recognized by the type guard", () => {
    expect(isAppError(new NotFoundError())).toBe(true);
    expect(isAppError(new Error("plain"))).toBe(false);
  });
});

describe("toErrorResponse", () => {
  it("maps AppError subclasses to their status and code", () => {
    const notFound = toErrorResponse(new NotFoundError("Pengguna tidak ditemukan"));
    expect(notFound.status).toBe(404);
    expect(notFound.body.error).toEqual({
      code: "NOT_FOUND",
      message: "Pengguna tidak ditemukan",
    });

    const forbidden = toErrorResponse(new ForbiddenError());
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");
  });

  it("maps ZodError to 400 with field paths, without input values", () => {
    const schema = z.strictObject({
      phone: z.string().regex(/^\+?[0-9]{8,15}$/, "Nomor telepon tidak valid"),
    });
    const result = schema.safeParse({ phone: "SECRET-VALUE-42", evil: true });
    expect(result.success).toBe(false);
    if (result.success) throw new Error("input should have been rejected");

    const response = toErrorResponse(result.error);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");

    const paths = response.body.error.fields?.map((f) => f.path);
    expect(paths).toContain("phone");
    expect(paths).toContain("evil");

    // Field paths and messages only — the rejected value must not leak.
    expect(JSON.stringify(response)).not.toContain("SECRET-VALUE-42");
  });

  it("maps nested Zod paths with dot notation", () => {
    const error = new ZodError([
      {
        code: "invalid_type",
        expected: "string",
        input: 1,
        path: ["profile", "name"],
        message: "Invalid input: expected string, received number",
      },
    ]);

    const response = toErrorResponse(error);
    expect(response.body.error.fields).toEqual([
      { path: "profile.name", message: "Invalid input: expected string, received number" },
    ]);
  });

  it("collapses unknown errors to a generic 500", () => {
    const response = toErrorResponse(
      new Error("connect ECONNREFUSED db.internal host=hunter2"),
    );
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(response)).not.toContain("ECONNREFUSED");
    expect(JSON.stringify(response)).not.toContain("hunter2");
  });

  it("is safe for non-error throwables", () => {
    const response = toErrorResponse("just a string");
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
  });

  it("keeps AppError distinct from ZodError handling", () => {
    // An AppError must never be swallowed by the Zod branch.
    const err: AppError = new ConflictError();
    expect(toErrorResponse(err).status).toBe(409);
  });
});
