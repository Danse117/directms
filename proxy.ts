// proxy.ts
// Next.js 16 renamed middleware.ts → proxy.ts. The exported function
// is `proxy` (not `middleware`). Runtime is Node.js only.

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/session'

export async function proxy(request: NextRequest) {
  // Always refresh the Supabase session cookie
  const response = await updateSession(request)

  const { pathname } = request.nextUrl

  // Only guard /admin/* routes (except /admin/login)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    // Check if the user has a Supabase session cookie.
    // This is an optimistic check — real auth verification happens
    // in the admin layout and every Server Action.
    const hasSession = request.cookies
      .getAll()
      .some((c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))

    if (!hasSession) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // Redirect authenticated users away from /admin/login
  if (pathname === '/admin/login') {
    const hasSession = request.cookies
      .getAll()
      .some((c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))

    if (hasSession) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
