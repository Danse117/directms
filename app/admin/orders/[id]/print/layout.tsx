import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import './print.css'

export const metadata: Metadata = {
  title: 'Print Invoice',
}

export default async function PrintLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Strict server-side auth gate. This route is outside the (dashboard) group,
  // so the dashboard layout's check does not apply here; proxy.ts is optimistic
  // and not a substitute (see CLAUDE.md invariant #3).
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  return <>{children}</>
}
