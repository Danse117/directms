// lib/email/send-inquiry-notification.ts
import { getResend } from '@/lib/email/resend'
import { serverEnv } from '@/lib/env'
import { InquiryNotification } from './templates/inquiry-notification'

export type SendInquiryNotificationInput = {
  name: string
  businessName: string | null | undefined
  email: string
  phone: string | null | undefined
  requestedItem: string
  details: string | null | undefined
}

export async function sendInquiryNotification(
  input: SendInquiryNotificationInput
): Promise<void> {
  const env = serverEnv()
  const resend = getResend()
  const { error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: env.ADMIN_NOTIFICATION_EMAIL,
    replyTo: input.email,
    subject: `New inquiry: ${input.requestedItem}`,
    react: InquiryNotification({
      name: input.name,
      businessName: input.businessName,
      email: input.email,
      phone: input.phone,
      requestedItem: input.requestedItem,
      details: input.details,
    }),
  })
  if (error) throw new Error(error.message)
}
