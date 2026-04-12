// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { serverEnv } from '@/lib/env'

/**
 * Cookie-aware Supabase client for Server Components and Server Actions.
 *
 * Per Next.js 16, `cookies()` is async — every call must be awaited.
 * The `setAll` callback is allowed to throw inside Server Components
 * because cookies cannot be set during streaming render; it succeeds
 * inside Server Actions and Route Handlers, which is where we actually
 * need to write cookies (Phase 3 admin auth).
 */
export async function createServerSupabaseClient() {
  const env = serverEnv()
  const cookieStore = await cookies()

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Called from a Server Component; ignore.
            // The matching call will succeed inside the Server Action
            // or proxy.ts that triggered the auth refresh.
          }
        },
      },
    }
  )
}
