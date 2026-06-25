import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireTournamentAccess } from '@/lib/supabase/auth-guards'
import { getClubsForTournament } from '@/lib/actions/clubs'
import { ClubListClient } from './club-list-client'

interface PageProps {
  params: Promise<{ slug: string }>
}

/**
 * /admin/tournaments/[slug]/clubs — Club management page (US-0074).
 *
 * Server Component. Auth-guards, fetches tournament and club list via
 * getClubsForTournament, then renders ClubListClient with dnd-kit
 * drag-to-reorder, inline edit, toggle, and soft delete.
 */
export default async function TournamentClubsPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('id, name, slug')
    .eq('slug', slug)
    .single()

  if (tournamentError || !tournament) notFound()

  await requireTournamentAccess(tournament.id)

  const { data: clubs, error } = await getClubsForTournament(tournament.id)

  if (error) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-8">
        <p className="text-red-600">Failed to load clubs. Please refresh the page.</p>
      </main>
    )
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{tournament.name} — Clubs</h1>
      <ClubListClient clubs={clubs} tournamentId={tournament.id} />
    </main>
  )
}
