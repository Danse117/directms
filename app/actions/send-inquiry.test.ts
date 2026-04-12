// app/actions/send-inquiry.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/data/inquiries', () => ({
  createInquiry: vi.fn(),
}))
const { createInquiry } = await import('@/lib/data/inquiries')

function buildFormData(payload: unknown, honeypot = '') {
  const fd = new FormData()
  fd.set('payload', JSON.stringify(payload))
  fd.set('website', honeypot)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('sendInquiryAction', () => {
  it('inserts the inquiry and returns ok', async () => {
    vi.mocked(createInquiry).mockResolvedValue({
      id: 'inq-1',
      name: 'Jane',
      businessName: 'Acme',
      email: 'jane@example.com',
      phone: null,
      requestedItem: 'Geek Bar 25k',
      details: null,
      createdAt: '2026-04-11T12:00:00Z',
    })
    const { sendInquiryAction } = await import('./send-inquiry')
    const result = await sendInquiryAction(
      { ok: false },
      buildFormData({
        name: 'Jane',
        businessName: 'Acme',
        email: 'jane@example.com',
        phone: '',
        requestedItem: 'Geek Bar 25k',
        details: '',
      })
    )

    expect(result.ok).toBe(true)
    expect(result.submittedAt).toBeTypeOf('number')
    expect(createInquiry).toHaveBeenCalledTimes(1)
  })

  it('returns ok without writing when the honeypot is filled', async () => {
    const { sendInquiryAction } = await import('./send-inquiry')
    const result = await sendInquiryAction(
      { ok: false },
      buildFormData(
        {
          name: 'Spam',
          businessName: '',
          email: 'spam@bot.com',
          phone: '',
          requestedItem: 'X',
          details: '',
        },
        'http://spam.example'
      )
    )

    expect(result.ok).toBe(true)
    expect(createInquiry).not.toHaveBeenCalled()
  })

  it('returns field errors for invalid input', async () => {
    const { sendInquiryAction } = await import('./send-inquiry')
    const result = await sendInquiryAction(
      { ok: false },
      buildFormData({
        name: '',
        businessName: '',
        email: 'not-an-email',
        phone: '',
        requestedItem: '',
        details: '',
      })
    )

    expect(result.ok).toBe(false)
    expect(result.fieldErrors).toBeDefined()
    expect(result.fieldErrors?.name).toBeDefined()
    expect(result.fieldErrors?.email).toBeDefined()
    expect(result.fieldErrors?.requestedItem).toBeDefined()
    expect(createInquiry).not.toHaveBeenCalled()
  })

})
