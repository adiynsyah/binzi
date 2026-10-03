// Input contracts for authentication (card A-09).
//
// Pure Zod, no server imports: the A-13 sign-in/sign-up forms import these
// schemas for client-side validation so both sides enforce the exact same
// rules (AUTH-01). `src/components/ui/password-rules.ts` should switch to
// importing `passwordSchema`/`PASSWORD_MIN_LENGTH` from here (A-13).
import { z } from "zod";

/** AUTH-01: minimum password length. Mirrors Better Auth `minPasswordLength`. */
export const PASSWORD_MIN_LENGTH = 8;

/** AUTH-01: min 8 characters, at least one letter and one digit. */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, {
    message: `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter`,
  })
  .regex(/[A-Za-z]/, { message: "Kata sandi harus mengandung huruf" })
  .regex(/[0-9]/, { message: "Kata sandi harus mengandung angka" });

/** Normalizes an email for bucket keys and lookups (no validation). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** A-11: sane upper bound for a redirect path carried in a link or request. */
export const INTERNAL_REDIRECT_MAX_LENGTH = 2048;

// Encoded path separators (`%2F` / `%5C`) in the path portion: we never
// decode these params, so they cannot redirect anywhere by themselves — but
// rejecting them keeps the guarantee even if a future consumer decodes.
const ENCODED_SEPARATOR_PATTERN = /%2f|%5c/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/;

// Any https origin works: it is only a parsing anchor for the URL parser's
// final say — the value must resolve to a path of that origin.
const REDIRECT_PARSE_ORIGIN = "https://redirect.internal";

/**
 * A-11 (card "Kerjakan", §14.2): every post-auth redirect target must be an
 * INTERNAL path. Accepts only root-relative paths (`/materi/2`, `/x?q=1`) —
 * absolute URLs (even this app's own origin), protocol-relative URLs
 * (`//evil.com`), backslash tricks (`/\evil.com`), `javascript:`-style
 * schemes, percent-encoded separator variants (`%2F%2Fevil.com`), control
 * characters, and oversized values are all rejected.
 *
 * Returns the trimmed path, or null when the value is not a safe target.
 */
export function safeInternalRedirectPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  // A leading "/" excludes schemes (https:, javascript:, mailto:…), relative
  // paths, and encoded variants such as "%2F%2Fevil.com" in one stroke.
  if (!candidate.startsWith("/")) return null;
  if (candidate.startsWith("//")) return null;
  if (candidate.includes("\\")) return null;
  if (CONTROL_CHARACTER_PATTERN.test(candidate)) return null;
  // Encoded separators matter in the PATH (path smuggling); an encoded value
  // inside a query string is plain data, same line Better Auth draws.
  const pathEnd = candidate.search(/[?#]/);
  const path = pathEnd === -1 ? candidate : candidate.slice(0, pathEnd);
  if (ENCODED_SEPARATOR_PATTERN.test(path)) return null;
  if (candidate.length > INTERNAL_REDIRECT_MAX_LENGTH) return null;
  let parsed: URL;
  try {
    parsed = new URL(candidate, REDIRECT_PARSE_ORIGIN);
  } catch {
    return null;
  }
  if (parsed.origin !== REDIRECT_PARSE_ORIGIN) return null;
  return candidate;
}

export const signInSchema = z.object({
  email: z.email({ message: "Format email tidak valid" }),
  password: z.string().min(1, { message: "Kata sandi wajib diisi" }),
});

export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Nama wajib diisi" })
    .max(128, { message: "Nama maksimal 128 karakter" }),
  email: z.email({ message: "Format email tidak valid" }),
  password: passwordSchema,
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
