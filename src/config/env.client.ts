import { z } from 'zod'

// Client-exposed environment variables (NEXT_PUBLIC_* only).
//
// Every variable is read as a literal `process.env.NEXT_PUBLIC_*` member
// expression so the Next.js compiler can inline the values into the client
// bundle — never pass `process.env` around as a whole object in this file.

// A copied .env.example has empty values; treat those as unset so they do not
// trip validation before their owning task makes them required.
const emptyAsUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value

const optionalEnvString = z.preprocess(emptyAsUndefined, z.string().trim().min(1).optional())

const clientEnvSchema = z.object({
  // Required from the start; used for links, metadata, and auth redirects.
  NEXT_PUBLIC_APP_URL: z.url(),
  // H-05 — Cloudflare Turnstile; required from A-09 (auth form protection).
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalEnvString,
  // H-09 — Sentry; required once the Sentry integration lands.
  NEXT_PUBLIC_SENTRY_DSN: optionalEnvString,
})

function parseClientEnv() {
  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  })
  if (!result.success) {
    throw new Error(formatIssues(result.error))
  }
  return result.data
}

// Reports variable names and problem kinds only — values are never included.
function formatIssues(error: z.ZodError): string {
  const lines = error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
  return `Invalid client environment variables:\n${lines.join('\n')}`
}

export const clientEnv = parseClientEnv()
