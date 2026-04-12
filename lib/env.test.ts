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
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'

    const { serverEnv } = await import('./env')
    const env = serverEnv()
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://example.supabase.co')
    expect(env.NEXT_PUBLIC_SITE_URL).toBe('http://localhost:3000')
  })

  it('throws a descriptive error when a required var is missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
    // NEXT_PUBLIC_SITE_URL intentionally missing
    delete process.env.NEXT_PUBLIC_SITE_URL

    const { serverEnv } = await import('./env')
    expect(() => serverEnv()).toThrow(/NEXT_PUBLIC_SITE_URL/)
  })
})
