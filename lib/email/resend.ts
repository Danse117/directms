import { Resend } from 'resend'

let cached: Resend | null = null

/**
 * Lazy singleton Resend client. Currently unused — email sending is
 * disabled. Scaffolded for future re-enablement. Reads RESEND_API_KEY
 * directly from process.env (not from serverEnv, which no longer
 * validates Resend keys).
 */
export function getResend(): Resend {
  if (cached) return cached
  const key = process.env.RESEND_API_KEY ?? ''
  cached = new Resend(key)
  return cached
}

/**
 * Test-only escape hatch. Tests should prefer `vi.mock('@/lib/email/resend')`,
 * but if a test needs to swap the singleton in-place this is the way.
 */
export function __resetResendForTests() {
  cached = null
}
