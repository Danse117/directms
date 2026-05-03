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
  // Defense-in-depth: verify auth server-side (proxy.ts is optimistic).
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  return <>{children}</>
}
