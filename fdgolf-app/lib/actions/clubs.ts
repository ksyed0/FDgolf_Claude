'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

type ClubsActionState = { error: string | null; success: boolean }

/**
 * saveClubsAction — Server Action for tournament club picker (US-0015).
 *
 * Upserts rows into tournament_clubs for every club submitted as active.
 * Clubs not in active_club_id list are deleted (or not inserted) so the
 * tournament_clubs table reflects the admin's selection.
 *
 * tournament_clubs invariant: zero rows (new tournament) or all is_active=true rows
 *   both mean "all clubs active". The US-0031 bag picker must handle BOTH states.
 *
 *   When tournament_clubs has zero rows, ALL clubs are considered active by
 *   convention. Submitting a partial list restricts the available clubs.
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
    return { error: 'Tournament ID is required.', success: false }
  }

  const supabase = await createClient()

  // Guard: must be admin
  const { data: isAdmin, error: adminError } = await supabase.rpc('fdgolf_is_admin')
  if (adminError || !isAdmin) {
    return { error: 'Unauthorized: admin role required', success: false }
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
    return { error: deleteError.message, success: false }
  }

  // If no clubs are active (or all are active via the no-rows invariant),
  // leaving the table empty is valid. Insert only when there are active clubs.
  if (activeClubIds.length > 0) {
    const rows = activeClubIds.map((clubId) => ({
      tournament_id: tournamentId,
      club_id: clubId,
      is_active: true,
    }))

    const { error: insertError } = await supabase.from('tournament_clubs').insert(rows)

    if (insertError) {
      return { error: insertError.message, success: false }
    }
  }

  return { error: null, success: true }
}

// ── US-0074: Club management actions ─────────────────────────────────────────

export type ClubRow = {
  club_id: string
  name: string
  loft: number | null
  display_order: number
  is_active: boolean
}

export async function getClubsForTournament(
  tournamentId: string
): Promise<{ data: ClubRow[]; error: string | null }> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('tournament_clubs')
    .select('club_id, is_active, display_order, clubs!inner(name, loft, deleted_at)')
    .eq('tournament_id', tournamentId)
    .is('clubs.deleted_at', null)
    .order('display_order', { ascending: true })
  if (error) return { data: [], error: error.message }
  return {
    data: (data ?? []).map((row) => {
      const club = row.clubs as unknown as { name: string; loft: number | null }
      return {
        club_id: row.club_id,
        name: club.name,
        loft: club.loft,
        display_order: row.display_order,
        is_active: row.is_active,
      }
    }),
    error: null,
  }
}

export async function reorderClubsAction(
  tournamentId: string,
  orderedClubIds: string[]
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized' }

  const db = createServiceClient()
  for (let i = 0; i < orderedClubIds.length; i++) {
    const { error } = await db
      .from('tournament_clubs')
      .update({ display_order: i })
      .eq('club_id', orderedClubIds[i])
      .eq('tournament_id', tournamentId)
    if (error) return { error: error.message }
  }
  return { error: null }
}

export async function toggleClubActiveAction(
  clubId: string,
  tournamentId: string,
  isActive: boolean
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized' }

  const db = createServiceClient()

  if (!isActive) {
    const { count } = await db
      .from('tournament_clubs')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .eq('is_active', true)

    if ((count ?? 0) <= 1) {
      return { error: 'At least one club must remain active' }
    }
  }

  const { error } = await db
    .from('tournament_clubs')
    .update({ is_active: isActive })
    .eq('club_id', clubId)
    .eq('tournament_id', tournamentId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function updateClubAction(
  clubId: string,
  updates: { name?: string; loft?: number | null }
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized' }

  const db = createServiceClient()
  const { error } = await db.from('clubs').update(updates).eq('id', clubId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function deleteClubAction(clubId: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized' }

  const db = createServiceClient()
  const { error } = await db
    .from('clubs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', clubId)
  if (error) return { error: error.message }
  return { error: null }
}
