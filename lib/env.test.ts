// lib/env.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('serverEnv', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('returns all required vars when present', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
    process.env.RESEND_API_KEY = 're_test'
    process.env.RESEND_FROM_EMAIL = 'shop@example.com'
    process.env.ADMIN_NOTIFICATION_EMAIL = 'admin@example.com'
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'

    const { serverEnv } = await import('./env')
    const env = serverEnv()
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://example.supabase.co')
    expect(env.RESEND_API_KEY).toBe('re_test')
    expect(env.ADMIN_NOTIFICATION_EMAIL).toBe('admin@example.com')
  })

  it('throws a descriptive error when a required var is missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
    // RESEND_API_KEY intentionally missing
    delete process.env.RESEND_API_KEY
    process.env.RESEND_FROM_EMAIL = 'shop@example.com'
    process.env.ADMIN_NOTIFICATION_EMAIL = 'admin@example.com'
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'

    const { serverEnv } = await import('./env')
    expect(() => serverEnv()).toThrow(/RESEND_API_KEY/)
  })
})
