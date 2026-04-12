// lib/email/templates/inquiry-notification.tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export type InquiryNotificationProps = {
  name: string
  businessName: string | null | undefined
  email: string
  phone: string | null | undefined
  requestedItem: string
  details: string | null | undefined
}

export function InquiryNotification({
  name,
  businessName,
  email,
  phone,
  requestedItem,
  details,
}: InquiryNotificationProps) {
  return (
    <Html>
      <Head />
      <Preview>New product inquiry: {requestedItem}</Preview>
      <Body
        style={{
          backgroundColor: '#fdf8f3',
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          color: '#1c1c1c',
          padding: '24px 0',
        }}
      >
        <Container
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '560px',
            margin: '0 auto',
            border: '1px solid #efe6d8',
          }}
        >
          <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px 0' }}>
            New product inquiry
          </Heading>

          <Section>
            <Text style={{ margin: '0 0 4px 0', fontWeight: 600 }}>
              Requested item
            </Text>
            <Text style={{ margin: '0 0 16px 0' }}>{requestedItem}</Text>

            <Hr
              style={{
                border: 'none',
                borderTop: '1px solid #efe6d8',
                margin: '12px 0',
              }}
            />

            <Text style={{ margin: '0 0 4px 0', fontWeight: 600 }}>From</Text>
            <Text style={{ margin: 0 }}>{name}</Text>
            {businessName ? (
              <Text style={{ margin: 0, color: '#7c7163' }}>{businessName}</Text>
            ) : null}
            <Text style={{ margin: '4px 0 0 0', color: '#7c7163' }}>{email}</Text>
            {phone ? (
              <Text style={{ margin: 0, color: '#7c7163' }}>{phone}</Text>
            ) : null}

            {details ? (
              <>
                <Hr
                  style={{
                    border: 'none',
                    borderTop: '1px solid #efe6d8',
                    margin: '16px 0',
                  }}
                />
                <Text style={{ margin: '0 0 4px 0', fontWeight: 600 }}>Details</Text>
                <Text style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{details}</Text>
              </>
            ) : null}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
