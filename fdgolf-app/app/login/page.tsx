import { LoginForm } from './login-form'

interface LoginPageProps {
  searchParams: { next?: string }
}

/**
 * /login — email + password sign-in page.
 *
 * Server Component. Reads the `next` search param (set by middleware when
 * redirecting unauthenticated requests) and passes it to LoginForm so the
 * user is sent to their intended route after signing in (AC-0017).
 *
 * Branding: FDgolf forest green card design matching AppChrome (AC-0016).
 */
export default function LoginPage({ searchParams }: LoginPageProps) {
  const next = searchParams.next ?? '/'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Branded header — forest green matching AppChrome (AC-0016) */}
        <div
          style={{ backgroundColor: '#0e2818' }}
          className="px-6 py-5 flex flex-col items-center gap-1"
        >
          <span className="text-2xl font-bold tracking-tight leading-none">
            <span style={{ color: '#6ee7a0' }}>FD</span>
            <span className="text-white">golf</span>
          </span>
          <p className="text-xs text-white/60 mt-1">Sign in to your account</p>
        </div>

        {/* Form */}
        <div className="px-6 py-6">
          <LoginForm next={next} />
        </div>
      </div>
    </div>
  )
}
