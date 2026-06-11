import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClubPickerForm } from './club-picker-form'

interface PageProps {
  params: { slug: string }
}

type ClubRow = {
  id: string
  display_name: string
  club_type: string
  display_order: number
}

type TournamentClubRow = {
  club_id: string
}

/**
 * /admin/tournaments/[slug]/clubs — Tournament club picker page (US-0015).
 *
 * Server Component. Checks admin status, fetches tournament, all master clubs,
 * and existing tournament_clubs rows, then renders ClubPickerForm.
 *
 * AC-0067: All master clubs listed with toggle controls; defaults to all-active.
 *
 * "no rows = all clubs active" invariant:
 *   When tournament_clubs has no rows for this tournament, all clubs are active.
 *   ClubPickerForm receives an empty activeClubIds array in that case and
 *   defaults all toggles to on.
 */
export default async function TournamentClubsPage({ params }: PageProps) {
  const supabase = createClient()

  // Guard: must be admin
  const { data: isAdmin, error: adminError } = await supabase.rpc('fdgolf_is_admin')
  if (adminError || !isAdmin) {
    redirect('/')
  }

  // Fetch tournament by slug
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('id,name,slug')
    .eq('slug', params.slug)
    .single()

  if (tournamentError || !tournament) {
    notFound()
  }

  // Fetch all master clubs ordered by display_order
  const { data: allClubs, error: clubsError } = await supabase
    .from('clubs')
    .select('id,display_name,club_type,display_order')
    .order('display_order')

  if (clubsError || !allClubs?.length) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <p className="text-red-600">Failed to load clubs. Please refresh the page.</p>
      </div>
    )
  }

  // Fetch existing tournament_clubs rows to determine current active set
  const { data: tournamentClubs } = await supabase
    .from('tournament_clubs')
    .select('club_id')
    .eq('tournament_id', tournament.id)
    .eq('is_active', true)

  const activeClubIds = ((tournamentClubs ?? []) as TournamentClubRow[]).map(
    (row) => row.club_id
  )

  return (
    <ClubPickerForm
      tournamentId={tournament.id}
      tournamentName={tournament.name}
      allClubs={((allClubs ?? []) as ClubRow[])}
      activeClubIds={activeClubIds}
    />
  )
}
