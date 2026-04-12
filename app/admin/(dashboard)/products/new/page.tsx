import type { Metadata } from 'next'
import Link from 'next/link'
import { ProductForm } from '@/components/admin/product-form'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = { title: 'New Product' }

export default function AdminNewProductPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/products">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 size-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New Product</h1>
      </div>
      <ProductForm />
    </div>
  )
}
