// lib/email/send-inquiry-notification.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/email/resend', () => ({ getResend: vi.fn() }))

process.env.RESEND_FROM_EMAIL = 'orders@directms.example'
process.env.ADMIN_NOTIFICATION_EMAIL = 'admin@directms.example'

const { getResend } = await import('@/lib/email/resend')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('sendInquiryNotification', () => {
  it('emails the admin with the inquiry details', async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: 'm1' }, error: null })
    vi.mocked(getResend).mockReturnValue({ emails: { send } } as never)

    const { sendInquiryNotification } = await import('./send-inquiry-notification')
    await sendInquiryNotification({
      name: 'Jane Doe',
      businessName: 'Acme',
      email: 'jane@example.com',
      phone: '+1-555-0100',
      requestedItem: 'Geek Bar 25k',
      details: 'Looking for case quantities',
    })

    expect(send).toHaveBeenCalledTimes(1)
    const call = send.mock.calls[0][0]
    expect(call.from).toBe('orders@directms.example')
    expect(call.to).toBe('admin@directms.example')
    expect(call.subject).toContain('Geek Bar 25k')
    expect(call.replyTo).toBe('jane@example.com')
    expect(call.react).toBeDefined()
  })

  it('handles missing optional fields gracefully', async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: 'm1' }, error: null })
    vi.mocked(getResend).mockReturnValue({ emails: { send } } as never)

    const { sendInquiryNotification } = await import('./send-inquiry-notification')
    await sendInquiryNotification({
      name: 'Jane',
      businessName: undefined,
      email: 'jane@example.com',
      phone: undefined,
      requestedItem: 'X',
      details: undefined,
    })

    expect(send).toHaveBeenCalledTimes(1)
  })

  it('throws when resend returns an error', async () => {
    const send = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
    vi.mocked(getResend).mockReturnValue({ emails: { send } } as never)

    const { sendInquiryNotification } = await import('./send-inquiry-notification')
    await expect(
      sendInquiryNotification({
        name: 'Jane',
        businessName: undefined,
        email: 'jane@example.com',
        phone: undefined,
        requestedItem: 'X',
        details: undefined,
      })
    ).rejects.toThrow(/boom/)
  })
})
