// lib/supabase/session.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { serverEnv } from '@/lib/env'

/**
 * Refresh the Supabase session cookie on every matched request.
 * Called from `proxy.ts` in Phase 3. Phase 2 has no caller — the file
 * is scaffolded per spec §6.4.
 *
 * The filename is `session.ts` (not `middleware.ts`) to avoid colliding
 * with Next.js 16's `proxy.ts` rename — having two "middleware" concepts
 * in the same project is a footgun.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const env = serverEnv()

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  // Touching getUser() is what actually refreshes the session cookie.
  await supabase.auth.getUser()

  return response
}
