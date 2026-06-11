'use server'

import { createClient } from '@/lib/supabase/server'

type ClubsActionState = { error: string | null }

/**
 * saveClubsAction — Server Action for tournament club picker (US-0015).
 *
 * Upserts rows into tournament_clubs for every club submitted as active.
 * Clubs not in active_club_id list are deleted (or not inserted) so the
 * tournament_clubs table reflects the admin's selection.
 *
 * "no rows = all clubs active" invariant:
 *   When tournament_clubs has zero rows for a tournament, ALL clubs are
 *   considered active by convention. To express "all active" the admin
 *   submits all IDs which results in all rows being present, which is
 *   equivalent to the no-rows state. Conversely, submitting a partial
 *   list restricts the available clubs.
 *
 *   This invariant MUST be respected by any query that reads available
 *   clubs (e.g. bag picker in pre-round setup, US-0031): if
 *   tournament_clubs is empty, treat all master clubs as active.
 *
 * AC-0067: All master clubs listed with toggle controls; defaults to all-active.
 * AC-0068: Disabled clubs are excluded from the player's bag picker in pre-round setup.
 */
export async function saveClubsAction(
  _prevState: ClubsActionState,
  formData: FormData
): Promise<ClubsActionState> {
  const tournamentId = (formData.get('tournament_id') as string | null)?.trim() ?? ''

  if (!tournamentId) {
    return { error: 'Tournament ID is required.' }
  }

  const supabase = createClient()

  // Guard: must be admin
  const { data: isAdmin, error: adminError } = await supabase.rpc('fdgolf_is_admin')
  if (adminError || !isAdmin) {
    return { error: 'Unauthorized: admin role required' }
  }

  // Collect active club IDs from multi-value form field
  const activeClubIds = formData.getAll('active_club_id') as string[]

  // Delete all existing rows for this tournament, then re-insert the selection.
  // This is simpler and safer than a diff-based upsert for a small table.
  const { error: deleteError } = await supabase
    .from('tournament_clubs')
    .delete()
    .eq('tournament_id', tournamentId)

  if (deleteError) {
    return { error: deleteError.message }
  }

  // If no clubs are active (or all are active via the no-rows invariant),
  // leaving the table empty is valid. Insert only when there are active clubs.
  if (activeClubIds.length > 0) {
    const rows = activeClubIds.map((clubId) => ({
      tournament_id: tournamentId,
      club_id: clubId,
      is_active: true,
    }))

    const { error: insertError } = await supabase
      .from('tournament_clubs')
      .insert(rows)

    if (insertError) {
      return { error: insertError.message }
    }
  }

  return { error: null }
}
