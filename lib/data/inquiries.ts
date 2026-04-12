// lib/data/inquiries.ts
import { createServerSupabaseClient } from '@/lib/supabase/server'

export type Inquiry = {
  id: string
  name: string
  businessName: string | null
  email: string
  phone: string | null
  requestedItem: string
  details: string | null
  createdAt: string
}

type InquiryRow = {
  id: string
  name: string
  business_name: string | null
  email: string
  phone: string | null
  requested_item: string
  details: string | null
  created_at: string
}

function rowToInquiry(row: InquiryRow): Inquiry {
  return {
    id: row.id,
    name: row.name,
    businessName: row.business_name,
    email: row.email,
    phone: row.phone,
    requestedItem: row.requested_item,
    details: row.details,
    createdAt: row.created_at,
  }
}

export type CreateInquiryInput = {
  name: string
  businessName: string | null | undefined
  email: string
  phone: string | null | undefined
  requestedItem: string
  details: string | null | undefined
}

export async function createInquiry(
  input: CreateInquiryInput
): Promise<Inquiry> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('inquiries')
    .insert({
      name: input.name,
      business_name: input.businessName ?? null,
      email: input.email,
      phone: input.phone ?? null,
      requested_item: input.requestedItem,
      details: input.details ?? null,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return rowToInquiry(data as InquiryRow)
}

// ============================================================================
// Admin helpers — used in Phase 3.
// ============================================================================

export async function getInquiries(): Promise<Inquiry[]> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('inquiries')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row: InquiryRow) => rowToInquiry(row))
}

export async function getInquiryById(id: string): Promise<Inquiry | null> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('inquiries')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return rowToInquiry(data as InquiryRow)
}

export async function deleteInquiry(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('inquiries').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
