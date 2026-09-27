import { afterEach, describe, expect, it, vi } from 'vitest'

// `server-only` throws when bundled without the react-server condition; stub
// it so the module under test can be imported inside Vitest.
vi.mock('server-only', () => ({}))

const PLANTED_SECRET = 'sk-planted-secret-must-never-leak-123'

async function importServerEnv() {
  vi.resetModules()
  return import('./env.server')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('server env schema', () => {
  it('defaults MAIL_TRANSPORT to log in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { serverEnv } = await importServerEnv()
    expect(serverEnv.MAIL_TRANSPORT).toBe('log')
  })

  it('requires MAIL_TRANSPORT outside development', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await expect(importServerEnv()).rejects.toThrow(/MAIL_TRANSPORT/)
  })

  it('requires Resend credentials when MAIL_TRANSPORT=resend', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('MAIL_TRANSPORT', 'resend')
    const error = await importServerEnv().then(
      () => null,
      (e: Error) => e,
    )
    expect(error).toBeInstanceOf(Error)
    expect(error?.message).toMatch(/RESEND_API_KEY/)
    expect(error?.message).toMatch(/MAIL_FROM/)
  })

  it('accepts resend transport with credentials set', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('MAIL_TRANSPORT', 'resend')
    vi.stubEnv('RESEND_API_KEY', PLANTED_SECRET)
    vi.stubEnv('MAIL_FROM', 'no-reply@example.com')
    const { serverEnv } = await importServerEnv()
    expect(serverEnv.MAIL_TRANSPORT).toBe('resend')
  })

  it('rejects an invalid MAIL_TRANSPORT without echoing its value', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('MAIL_TRANSPORT', PLANTED_SECRET)
    const error = await importServerEnv().then(
      () => null,
      (e: Error) => e,
    )
    expect(error).toBeInstanceOf(Error)
    expect(error?.message).toMatch(/MAIL_TRANSPORT/)
    expect(error?.message).not.toContain(PLANTED_SECRET)
  })

  it('treats empty strings from a copied .env.example as unset', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DATABASE_URL', '')
    vi.stubEnv('BETTER_AUTH_SECRET', '   ')
    const { serverEnv } = await importServerEnv()
    expect(serverEnv.DATABASE_URL).toBeUndefined()
    expect(serverEnv.BETTER_AUTH_SECRET).toBeUndefined()
  })
})
