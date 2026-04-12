'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { productFormSchema, type ProductFormInput } from '@/lib/schemas/admin'
import {
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductVisibility,
  getProductById,
} from '@/lib/data/products'

async function requireAuth() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return supabase
}

export type ProductActionState = {
  ok: boolean
  error?: string
  fieldErrors?: Partial<Record<keyof ProductFormInput, string[]>>
}

export async function createProductAction(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const supabase = await requireAuth()

  const raw = {
    name: formData.get('name'),
    slug: formData.get('slug'),
    subtitle: formData.get('subtitle'),
    price: formData.get('price'),
    flavors: formData.get('flavors'),
    isVisible: formData.get('isVisible') ?? undefined,
    sortOrder: formData.get('sortOrder'),
  }

  const result = productFormSchema.safeParse(raw)
  if (!result.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields',
      fieldErrors: result.error.flatten()
        .fieldErrors as ProductActionState['fieldErrors'],
    }
  }

  // Handle image upload
  let imagePath: string | null = null
  const imageFile = formData.get('image')
  if (imageFile instanceof File && imageFile.size > 0) {
    const ext = imageFile.name.split('.').pop() ?? 'jpg'
    const storagePath = `products/${result.data.slug}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(storagePath, imageFile, { upsert: true })
    if (uploadError) {
      return { ok: false, error: `Image upload failed: ${uploadError.message}` }
    }
    imagePath = storagePath
  }

  try {
    await createProduct({
      name: result.data.name,
      slug: result.data.slug,
      subtitle: result.data.subtitle ?? null,
      price: result.data.price,
      flavors: result.data.flavors,
      imagePath,
      isVisible: result.data.isVisible,
      sortOrder: result.data.sortOrder,
    })
  } catch (err) {
    console.error('[createProductAction]', err)
    return { ok: false, error: 'Could not create product. The slug may already be taken.' }
  }

  revalidatePath('/admin/products')
  revalidatePath('/')
  return { ok: true }
}

export async function updateProductAction(
  id: string,
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const supabase = await requireAuth()

  const raw = {
    name: formData.get('name'),
    slug: formData.get('slug'),
    subtitle: formData.get('subtitle'),
    price: formData.get('price'),
    flavors: formData.get('flavors'),
    isVisible: formData.get('isVisible') ?? undefined,
    sortOrder: formData.get('sortOrder'),
  }

  const result = productFormSchema.safeParse(raw)
  if (!result.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields',
      fieldErrors: result.error.flatten()
        .fieldErrors as ProductActionState['fieldErrors'],
    }
  }

  // Handle image upload/replacement
  let imagePath: string | null = null
  const imageFile = formData.get('image')
  const existingImagePath = formData.get('existingImagePath') as string | null

  if (imageFile instanceof File && imageFile.size > 0) {
    if (existingImagePath) {
      await supabase.storage.from('product-images').remove([existingImagePath])
    }
    const ext = imageFile.name.split('.').pop() ?? 'jpg'
    const storagePath = `products/${result.data.slug}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(storagePath, imageFile, { upsert: true })
    if (uploadError) {
      return { ok: false, error: `Image upload failed: ${uploadError.message}` }
    }
    imagePath = storagePath
  } else {
    imagePath = existingImagePath ?? null
  }

  try {
    await updateProduct(id, {
      name: result.data.name,
      slug: result.data.slug,
      subtitle: result.data.subtitle ?? null,
      price: result.data.price,
      flavors: result.data.flavors,
      imagePath,
      isVisible: result.data.isVisible,
      sortOrder: result.data.sortOrder,
    })
  } catch (err) {
    console.error('[updateProductAction]', err)
    return { ok: false, error: 'Could not update product.' }
  }

  revalidatePath('/admin/products')
  revalidatePath('/')
  return { ok: true }
}

export async function deleteProductAction(id: string): Promise<void> {
  const supabase = await requireAuth()

  const product = await getProductById(id)
  if (product?.imagePath) {
    await supabase.storage.from('product-images').remove([product.imagePath])
  }

  await deleteProduct(id)
  revalidatePath('/admin/products')
  revalidatePath('/')
}

export async function toggleProductVisibilityAction(
  id: string,
  isVisible: boolean
): Promise<void> {
  await requireAuth()
  await toggleProductVisibility(id, isVisible)
  revalidatePath('/admin/products')
  revalidatePath('/')
}
