import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TournamentForm } from './tournament-form'

/**
 * /admin/tournaments/new — Tournament creation page (US-0009).
 *
 * Server Component. Checks admin status via fdgolf_is_admin() RPC (US-0006).
 * Redirects to / if the user is not an admin.
 * Renders TournamentForm on success.
 */
export default async function NewTournamentPage() {
  const supabase = createClient()

  const { data: isAdmin, error } = await supabase.rpc('fdgolf_is_admin')

  if (error || !isAdmin) {
    redirect('/')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Branded header */}
        <div
          style={{ backgroundColor: '#0e2818' }}
          className="px-6 py-5 flex flex-col items-center gap-1"
        >
          <span className="text-2xl font-bold tracking-tight leading-none">
            <span style={{ color: '#6ee7a0' }}>FD</span>
            <span className="text-white">golf</span>
          </span>
          <p className="text-xs text-white/60 mt-1">Create Tournament</p>
        </div>

        <div className="px-6 py-6">
          <TournamentForm />
        </div>
      </div>
    </div>
  )
}
