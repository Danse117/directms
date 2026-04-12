'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { markOrderFulfilled, deleteOrder } from '@/lib/data/orders'

async function requireAuth() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
}

export async function markOrderFulfilledAction(id: string): Promise<void> {
  await requireAuth()
  await markOrderFulfilled(id)
  revalidatePath('/admin/orders')
}

export async function deleteOrderAction(id: string): Promise<void> {
  await requireAuth()
  await deleteOrder(id)
  revalidatePath('/admin/orders')
}
