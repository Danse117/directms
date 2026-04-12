import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

const { createServerSupabaseClient } = await import('@/lib/supabase/server')
const { redirect } = await import('next/navigation')

function buildFormData(data: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value)
  }
  return fd
}

function mockSupabaseAuth(
  signInResult: { user: any; session: any } | null,
  signInError: { message: string } | null = null
) {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: signInResult ? { user: signInResult.user, session: signInResult.session } : { user: null, session: null },
        error: signInError,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('signInAction', () => {
  it('redirects to /admin on successful login', async () => {
    mockSupabaseAuth({ user: { id: 'u1', email: 'admin@test.com' }, session: {} })
    const { signInAction } = await import('./auth')

    await expect(
      signInAction({ ok: false }, buildFormData({ email: 'admin@test.com', password: 'secret' }))
    ).rejects.toThrow('NEXT_REDIRECT:/admin')

    expect(redirect).toHaveBeenCalledWith('/admin')
  })

  it('returns error on invalid credentials', async () => {
    mockSupabaseAuth(null, { message: 'Invalid login credentials' })
    const { signInAction } = await import('./auth')

    const result = await signInAction(
      { ok: false },
      buildFormData({ email: 'bad@test.com', password: 'wrong' })
    )

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/invalid/i)
  })

  it('returns field errors for invalid email format', async () => {
    const { signInAction } = await import('./auth')
    const result = await signInAction(
      { ok: false },
      buildFormData({ email: 'not-an-email', password: 'secret' })
    )

    expect(result.ok).toBe(false)
    expect(result.fieldErrors?.email).toBeDefined()
  })

  it('returns field errors for empty password', async () => {
    const { signInAction } = await import('./auth')
    const result = await signInAction(
      { ok: false },
      buildFormData({ email: 'admin@test.com', password: '' })
    )

    expect(result.ok).toBe(false)
    expect(result.fieldErrors?.password).toBeDefined()
  })
})

describe('signOutAction', () => {
  it('calls signOut and redirects to /admin/login', async () => {
    mockSupabaseAuth({ user: { id: 'u1' }, session: {} })
    const { signOutAction } = await import('./auth')

    await expect(signOutAction()).rejects.toThrow('NEXT_REDIRECT:/admin/login')
    expect(redirect).toHaveBeenCalledWith('/admin/login')
  })
})
