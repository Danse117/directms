// lib/env.ts
import { z } from 'zod'

/**
 * Server-side environment access with Zod validation.
 *
 * Why it's a function (not a top-level constant): top-level evaluation
 * happens at import time, which fights vitest's `process.env` mutation
 * pattern and Next.js's static analysis. Calling this from the request
 * path (Server Components, Server Actions) is cheap.
 *
 * Never import this from a Client Component — it will leak server-only
 * keys into the client bundle.
 */
const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().email(),
  ADMIN_NOTIFICATION_EMAIL: z.string().email(),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

export function serverEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env)
  if (!result.success) {
    const missing = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid environment configuration: ${missing}`)
  }
  return result.data
}

/**
 * Public env subset, safe to access from Client Components. Only contains
 * keys with the NEXT_PUBLIC_ prefix.
 */
export function publicEnv() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? '',
  }
}
