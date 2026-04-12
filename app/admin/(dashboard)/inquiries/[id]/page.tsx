import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getInquiryById } from '@/lib/data/inquiries'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = { title: 'Inquiry Detail' }

export default async function AdminInquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const inquiry = await getInquiryById(id)
  if (!inquiry) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/inquiries">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 size-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Inquiry</h1>
      </div>

      <div className="max-w-xl space-y-4 rounded-lg border border-border p-6">
        <div className="grid gap-1">
          <p className="text-sm font-medium text-muted-foreground">Name</p>
          <p>{inquiry.name}</p>
        </div>
        {inquiry.businessName && (
          <div className="grid gap-1">
            <p className="text-sm font-medium text-muted-foreground">Business</p>
            <p>{inquiry.businessName}</p>
          </div>
        )}
        <div className="grid gap-1">
          <p className="text-sm font-medium text-muted-foreground">Email</p>
          <p>{inquiry.email}</p>
        </div>
        {inquiry.phone && (
          <div className="grid gap-1">
            <p className="text-sm font-medium text-muted-foreground">Phone</p>
            <p>{inquiry.phone}</p>
          </div>
        )}
        <div className="grid gap-1">
          <p className="text-sm font-medium text-muted-foreground">Requested Item</p>
          <p>{inquiry.requestedItem}</p>
        </div>
        {inquiry.details && (
          <div className="grid gap-1">
            <p className="text-sm font-medium text-muted-foreground">Details</p>
            <p className="whitespace-pre-wrap">{inquiry.details}</p>
          </div>
        )}
        <div className="grid gap-1">
          <p className="text-sm font-medium text-muted-foreground">Submitted</p>
          <p className="text-sm text-muted-foreground">
            {new Date(inquiry.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}
