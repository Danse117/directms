import type { Metadata } from 'next'
import Link from 'next/link'
import { getInquiries } from '@/lib/data/inquiries'
import { deleteInquiryAction } from '@/app/actions/admin/inquiries'
import { DeleteDialog } from '@/components/admin/delete-dialog'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Eye } from 'lucide-react'

export const metadata: Metadata = { title: 'Inquiries' }

export default async function AdminInquiriesPage() {
  const inquiries = await getInquiries()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Inquiries</h1>

      {inquiries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No inquiries yet.</p>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Requested Item</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inquiries.map((inquiry) => (
                <TableRow key={inquiry.id}>
                  <TableCell className="font-medium">{inquiry.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {inquiry.businessName ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {inquiry.email}
                  </TableCell>
                  <TableCell>{inquiry.requestedItem}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(inquiry.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link href={`/admin/inquiries/${inquiry.id}`}>
                        <Button variant="ghost" size="sm" title="View details">
                          <Eye className="size-4" />
                        </Button>
                      </Link>
                      <DeleteDialog
                        title="Delete inquiry?"
                        description="This will permanently delete this inquiry. This action cannot be undone."
                        onConfirm={deleteInquiryAction.bind(null, inquiry.id)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
