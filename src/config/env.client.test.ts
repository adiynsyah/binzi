import { afterEach, describe, expect, it, vi } from 'vitest'

async function importClientEnv() {
  vi.resetModules()
  return import('./env.client')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('client env schema', () => {
  it('exposes NEXT_PUBLIC_APP_URL when valid', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
    const { clientEnv } = await importClientEnv()
    expect(clientEnv.NEXT_PUBLIC_APP_URL).toBe('http://localhost:3000')
  })

  it('fails naming NEXT_PUBLIC_APP_URL when missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    await expect(importClientEnv()).rejects.toThrow(/NEXT_PUBLIC_APP_URL/)
  })

  it('rejects a malformed URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'not-a-url')
    await expect(importClientEnv()).rejects.toThrow(/NEXT_PUBLIC_APP_URL/)
  })

  it('treats empty optional keys as unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '')
    const { clientEnv } = await importClientEnv()
    expect(clientEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBeUndefined()
  })
})
