// Driver-error shape helpers for the course module (card S1-01).
//
// Pure on purpose (no "server-only", no db import) so the mapping is unit
// testable without a database.
//
// drizzle-orm 0.45 wraps driver errors in DrizzleQueryError and keeps the
// original Postgres error on `error.cause`. The unique-violation code is
// "23505"; postgres.js exposes the constraint as `constraint_name`, PGlite
// as `constraint` — both shapes are checked.

type PgErrorLike = {
  code?: unknown;
  constraint?: unknown;
  constraint_name?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function constraintOf(error: unknown): string | null {
  if (!isObject(error)) return null;
  if (typeof error.constraint_name === "string") return error.constraint_name;
  if (typeof error.constraint === "string") return error.constraint;
  return null;
}

/**
 * True when `error` (or its DrizzleQueryError `cause`) is Postgres
 * 23505 for EXACTLY the named constraint. Any other unique violation is
 * left for the caller to rethrow — only courses.slug maps to a field error.
 */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  const candidates: unknown[] = [error];
  if (isObject(error) && isObject(error.cause)) {
    candidates.push(error.cause);
  }
  return candidates.some(
    (candidate) =>
      isObject(candidate) &&
      candidate.code === "23505" &&
      constraintOf(candidate) === constraint,
  );
}
