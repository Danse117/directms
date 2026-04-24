// app/auth/confirm/route.ts
// Handles email-based auth links from Supabase (invite + password recovery).
// The email template points here with ?token_hash=...&type=invite|recovery
// &next=/admin/set-password. We verify the OTP (planting session cookies)
// then bounce to `next`.

import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

function safeNext(raw: string | null): string {
  if (!raw) return '/admin'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/admin'
  return raw
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeNext(searchParams.get('next'))

  const redirectTo = request.nextUrl.clone()
  redirectTo.search = ''
  redirectTo.pathname = next

  if (token_hash && type) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      return NextResponse.redirect(redirectTo)
    }
  }

  redirectTo.pathname = '/admin/login'
  redirectTo.searchParams.set('error', 'link_invalid')
  return NextResponse.redirect(redirectTo)
}
