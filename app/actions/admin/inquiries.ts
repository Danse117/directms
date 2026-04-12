'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { deleteInquiry } from '@/lib/data/inquiries'

async function requireAuth() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
}

export async function deleteInquiryAction(id: string): Promise<void> {
  await requireAuth()
  await deleteInquiry(id)
  revalidatePath('/admin/inquiries')
}
