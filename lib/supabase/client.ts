// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import { publicEnv } from '@/lib/env'

/**
 * Browser-side Supabase client. Phase 2 does not call this — Phase 3's
 * admin login form is the first consumer. It's scaffolded here per
 * spec §6.4 so the wrapper trio is complete.
 */
export function createBrowserSupabaseClient() {
  const env = publicEnv()
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
