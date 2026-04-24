import type { Metadata } from 'next'
import { SetPasswordForm } from '@/components/admin/set-password-form'

export const metadata: Metadata = {
  title: 'Set Password',
}

export default function SetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-sm">
            D
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Set Password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a new password for your admin account
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <SetPasswordForm />
        </div>
      </div>
    </div>
  )
}
