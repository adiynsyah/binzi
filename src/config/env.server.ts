import 'server-only'

import { z } from 'zod'

// Server-only environment variables.
//
// The `server-only` guard turns any import from a Client Component (direct or
// transitive) into a build error, so values parsed here can never reach the
// client bundle. Everything is validated once at module scope: a bad
// configuration aborts startup immediately with a message that names the
// offending variable and never prints its value (PRD §12.5).

// A copied .env.example has empty values; treat those as unset so they do not
// trip validation before their owning task makes them required.
const emptyAsUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value

const optionalEnvString = z.preprocess(emptyAsUndefined, z.string().trim().min(1).optional())

const optionalEnvUrl = z.preprocess(emptyAsUndefined, z.url().optional())

// Custom error message so an invalid value is never echoed back.
const mailTransportSchema = z.preprocess(
  emptyAsUndefined,
  z.enum(['log', 'resend'], { error: 'must be "log" or "resend"' }).optional(),
)

const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    // Email: "log" prints to the server log, "resend" delivers via Resend.
    MAIL_TRANSPORT: mailTransportSchema,
    RESEND_API_KEY: optionalEnvString, // H-07; required when MAIL_TRANSPORT=resend (A-10)
    MAIL_FROM: optionalEnvString, // H-07; required when MAIL_TRANSPORT=resend (A-10)

    // Database (Supabase) — H-02; required from A-07 (Drizzle).
    DATABASE_URL: optionalEnvString, // transaction pooler (6543), app runtime
    MIGRATION_DATABASE_URL: optionalEnvString, // session pooler (5432), drizzle-kit

    // Auth — required from A-09 unless noted otherwise.
    BETTER_AUTH_SECRET: optionalEnvString, // H-10; random, >= 32 bytes
    BETTER_AUTH_URL: optionalEnvUrl, // same value as NEXT_PUBLIC_APP_URL
    GOOGLE_CLIENT_ID: optionalEnvString, // H-06; required from A-11
    GOOGLE_CLIENT_SECRET: optionalEnvString, // H-06; required from A-11
    TURNSTILE_SECRET_KEY: optionalEnvString, // H-05

    // Storage (Cloudflare R2) — H-04; required from A-17.
    R2_ACCOUNT_ID: optionalEnvString,
    R2_ACCESS_KEY_ID: optionalEnvString,
    R2_SECRET_ACCESS_KEY: optionalEnvString,
    R2_BUCKET: optionalEnvString,

    // Observability & ops.
    SENTRY_AUTH_TOKEN: optionalEnvString, // H-09; CI/Vercel only, never required locally
    CRON_SECRET: optionalEnvString, // H-10; required from A-18 (cron endpoint auth)
  })
  .superRefine((env, ctx) => {
    if (env.MAIL_TRANSPORT === 'resend') {
      for (const key of ['RESEND_API_KEY', 'MAIL_FROM'] as const) {
        if (!env[key]) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'required when MAIL_TRANSPORT=resend',
          })
        }
      }
    }
  })

export type ServerEnv = Omit<z.infer<typeof serverEnvSchema>, 'MAIL_TRANSPORT'> & {
  MAIL_TRANSPORT: 'log' | 'resend'
}

function parseServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env)
  if (!result.success) {
    throw new Error(formatIssues(result.error))
  }

  const parsed = result.data
  // Default to "log" in development only: everywhere else (production, CI) the
  // transport must be an explicit decision.
  const MAIL_TRANSPORT =
    parsed.MAIL_TRANSPORT ?? (parsed.NODE_ENV === 'development' ? 'log' : undefined)
  if (!MAIL_TRANSPORT) {
    throw new Error(
      'Invalid server environment variables:\n' +
        '  - MAIL_TRANSPORT: must be set explicitly outside development ("log" or "resend")',
    )
  }

  return { ...parsed, MAIL_TRANSPORT }
}

// Reports variable names and problem kinds only — values are never included.
function formatIssues(error: z.ZodError): string {
  const lines = error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
  return `Invalid server environment variables:\n${lines.join('\n')}`
}

export const serverEnv = parseServerEnv()
