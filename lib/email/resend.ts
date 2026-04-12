import { Resend } from 'resend'
import { serverEnv } from '@/lib/env'

let cached: Resend | null = null

/**
 * Lazy singleton Resend client. Lazy because instantiating at module load
 * trips Next.js's static analysis when env vars aren't set yet (e.g.,
 * during the migration tasks before .env.local exists).
 */
export function getResend(): Resend {
  if (cached) return cached
  const env = serverEnv()
  cached = new Resend(env.RESEND_API_KEY)
  return cached
}

/**
 * Test-only escape hatch. Tests should prefer `vi.mock('@/lib/email/resend')`,
 * but if a test needs to swap the singleton in-place this is the way.
 */
export function __resetResendForTests() {
  cached = null
}
