import { ResetPasswordForm } from './reset-password-form'

export default function ResetPasswordPage() {
  return (
    <main className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-2">Reset password</h1>
      <p className="text-gray-500 text-sm mb-6">Enter your new password below.</p>
      <ResetPasswordForm />
    </main>
  )
}
