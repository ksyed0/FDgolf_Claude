import { createClient } from '@/lib/supabase/server'
import { validateInviteToken } from '@/lib/actions/invitations'
import Link from 'next/link'
import { SponsorBar } from '@/components/sponsor-bar'

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { slug } = await params
  const { token } = await searchParams
  const supabase = await createClient()

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, slug, status, starts_at, venues(name)')
    .eq('slug', slug)
    .single()

  if (!tournament) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-gray-500">Tournament not found.</p>
      </main>
    )
  }

  if (tournament.status !== 'registration_open') {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold text-gray-900">{tournament.name}</h1>
          <p className="text-gray-500">Registration is not open for this tournament.</p>
        </div>
      </main>
    )
  }

  let inviteToken: string | null = null
  if (token) {
    const { data } = await validateInviteToken(token)
    if (!data) {
      return (
        <main className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center space-y-2">
            <h1 className="text-xl font-bold text-gray-900">{tournament.name}</h1>
            <p className="text-gray-500">
              This invite link is no longer valid. Contact your organiser.
            </p>
          </div>
        </main>
      )
    }
    inviteToken = token
  }

  const venue = Array.isArray(tournament.venues) ? tournament.venues[0] : tournament.venues
  const accountHref = `/register/${slug}/account${inviteToken ? `?token=${inviteToken}` : ''}`

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
          {venue?.name && <p className="text-sm text-gray-500 mt-1">{venue.name}</p>}
          {tournament.starts_at && (
            <p className="text-sm text-gray-500">
              {new Date(tournament.starts_at).toLocaleDateString('en-CA', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          )}
        </div>

        <SponsorBar sponsorLogos={null} />

        <div className="space-y-3">
          <Link
            href={accountHref}
            className="block w-full text-center px-4 py-3 bg-green-700 text-white rounded-lg font-semibold hover:bg-green-800 transition-colors"
          >
            Register →
          </Link>
          <Link
            href="/login"
            className="block w-full text-center px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            I already have an account
          </Link>
        </div>
      </div>
    </main>
  )
}
