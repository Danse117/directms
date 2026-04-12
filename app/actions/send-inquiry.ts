// app/actions/send-inquiry.ts
'use server'

import { inquirySchema, type InquiryInput } from '@/lib/schemas/inquiry'
import { createInquiry } from '@/lib/data/inquiries'

export type SendInquiryState = {
  ok: boolean
  error?: string
  fieldErrors?: Partial<Record<keyof InquiryInput, string[]>>
  submittedAt?: number
}

export async function sendInquiryAction(
  _prevState: SendInquiryState,
  formData: FormData
): Promise<SendInquiryState> {
  // 1. Honeypot
  const honeypot = formData.get('website')
  if (typeof honeypot === 'string' && honeypot.trim().length > 0) {
    return { ok: true, submittedAt: Date.now() }
  }

  // 2. Parse JSON payload
  const raw = formData.get('payload')
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Missing payload' }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'Invalid JSON payload' }
  }

  // 3. Zod validate
  const result = inquirySchema.safeParse(parsed)
  if (!result.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields',
      fieldErrors: result.error.flatten()
        .fieldErrors as SendInquiryState['fieldErrors'],
    }
  }
  const input = result.data

  // 4. Insert
  try {
    await createInquiry({
      name: input.name,
      businessName: input.businessName,
      email: input.email,
      phone: input.phone,
      requestedItem: input.requestedItem,
      details: input.details,
    })
  } catch (err) {
    console.error('[sendInquiry] createInquiry failed:', err)
    return {
      ok: false,
      error: 'Could not send your inquiry. Please try again in a moment.',
    }
  }

  return { ok: true, submittedAt: Date.now() }
}
