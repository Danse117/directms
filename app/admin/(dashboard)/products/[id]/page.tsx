import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getProductById } from '@/lib/data/products'
import { ProductForm } from '@/components/admin/product-form'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = { title: 'Edit Product' }

export default async function AdminEditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = await getProductById(id)
  if (!product) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/products">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 size-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Edit: {product.name}
        </h1>
      </div>
      <ProductForm product={product} />
    </div>
  )
}
