// AppChrome — persistent header shell rendered on every page.
// Server Component: no "use client" directive.
// Logout form uses a Server Action — valid in Server Components (Next.js 14).

import Link from 'next/link'
import { logoutAction } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/server'

export async function AppChrome() {
  const supabase = createClient()
  const [
    { data: isAdmin },
    {
      data: { user },
    },
  ] = await Promise.all([supabase.rpc('fdgolf_is_admin'), supabase.auth.getUser()])

  return (
    <header
      style={{ backgroundColor: '#0e2818' }}
      className="w-full flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8"
      role="banner"
    >
      {/* Left: FDgolf brand mark + admin nav */}
      <div className="flex items-center gap-6">
        <Link href="/" aria-label="FDgolf">
          <span className="text-xl font-bold tracking-tight leading-none">
            <span style={{ color: '#6ee7a0' }}>FD</span>
            <span className="text-white">golf</span>
          </span>
        </Link>

        {isAdmin && (
          <nav className="flex items-center gap-4" aria-label="Admin navigation">
            <Link
              href="/admin/tournaments"
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Tournaments
            </Link>
            <Link
              href="/admin/venues"
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Venues
            </Link>
            <Link
              href="/admin/organizers"
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Organizers
            </Link>
          </nav>
        )}
      </div>

      {/* Right: logout + AI/RUN badge */}
      <div className="flex items-center gap-3">
        {user && (
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-xs text-white/70 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </form>
        )}

        <span className="text-white text-xs opacity-70 hidden sm:inline">built with</span>
        <span
          className="text-xs font-semibold tracking-widest uppercase px-2 py-0.5 rounded border border-white/30 text-white"
          aria-label="AI/RUN"
        >
          AI/RUN
        </span>
      </div>
    </header>
  )
}
