import { ForgotPasswordForm } from './forgot-password-form'

export default function ForgotPasswordPage() {
  return (
    <main className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-2">Forgot password</h1>
      <p className="text-gray-500 text-sm mb-6">
        Enter your email and we'll send you a reset link.
      </p>
      <ForgotPasswordForm />
    </main>
  )
}
