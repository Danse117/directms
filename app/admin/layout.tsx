import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Admin · DirectMS',
    template: '%s · Admin · DirectMS',
  },
}

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
