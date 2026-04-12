'use server'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { loginSchema, type LoginInput } from '@/lib/schemas/admin'

export type SignInState = {
  ok: boolean
  error?: string
  fieldErrors?: Partial<Record<keyof LoginInput, string[]>>
}

export async function signInAction(
  _prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
  }

  const result = loginSchema.safeParse(raw)
  if (!result.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields',
      fieldErrors: result.error.flatten()
        .fieldErrors as SignInState['fieldErrors'],
    }
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: result.data.email,
    password: result.data.password,
  })

  if (error) {
    return { ok: false, error: 'Invalid email or password' }
  }

  redirect('/admin')
}

export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
}
