// Domain errors → HTTP responses (A-08 pattern).
//
// Services throw these; route handlers / server actions translate them with
// toErrorResponse() and return `NextResponse.json(body, { status })`.
//
// REQUIRED at the call site (not installed in this card): report the
// ORIGINAL error to Sentry (or the logger) BEFORE calling toErrorResponse().
// The 500 response body is deliberately generic, so the detailed error must
// reach telemetry elsewhere — otherwise it is lost forever.
//
// Status semantics — keep them distinct:
// - 404 NotFoundError: resource missing, OR present but not owned by the
//   actor. Reporting 403 there would confirm the resource exists (IDOR).
// - 403 ForbiddenError: authenticated, but the role is not enough. The
//   existence of the resource is not a secret here — only the right is.
import { ZodError } from "zod";

export type FieldIssue = {
  path: string;
  message: string;
};

export type ErrorResponse = {
  status: number;
  body: {
    error: {
      code: string;
      message: string;
      /** Present only for validation failures (400). */
      fields?: FieldIssue[];
    };
  };
};

export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Permintaan tidak valid") {
    super(400, "BAD_REQUEST", message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Anda harus masuk terlebih dahulu") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Anda tidak memiliki izin untuk aksi ini") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Data tidak ditemukan") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Konflik dengan kondisi data saat ini") {
    super(409, "CONFLICT", message);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Map any thrown value to a safe HTTP response shape. Input values are never
 * echoed: Zod issues contribute only field paths and messages.
 */
export function toErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: { error: { code: error.code, message: error.message } },
    };
  }

  if (error instanceof ZodError) {
    // Unrecognized keys carry an empty path but name the keys explicitly —
    // surface one entry per key so clients can attach errors to fields.
    const fields: FieldIssue[] = [];
    for (const issue of error.issues) {
      if (issue.code === "unrecognized_keys") {
        for (const key of issue.keys) {
          fields.push({ path: key, message: issue.message });
        }
      } else {
        fields.push({
          path: issue.path.map(String).join("."),
          message: issue.message,
        });
      }
    }

    return {
      status: 400,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Validasi input gagal",
          fields,
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: { code: "INTERNAL_ERROR", message: "Terjadi kesalahan tak terduga" },
    },
  };
}
