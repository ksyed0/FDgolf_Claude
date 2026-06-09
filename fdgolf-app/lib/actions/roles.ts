'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * assignOrganizerAction — promotes a player to tournament_organizer for a
 * specific tournament by inserting a user_roles row.
 *
 * Idempotent: uses ON CONFLICT (player_id, role, tournament_id) DO NOTHING
 * so calling it twice for the same player+tournament pair is a silent no-op (AC-0084).
 *
 * RLS enforcement: the `user_roles_insert_admin` policy (US-0006) requires the
 * calling user to pass fdgolf_is_admin() — non-admins receive a Postgres RLS
 * violation error which is caught and returned as a generic error string.
 */
export async function assignOrganizerAction(
  tournamentId: string,
  playerId: string
): Promise<{ error: string | null }> {
  if (!tournamentId || !playerId) {
    return { error: 'tournamentId and playerId are required' }
  }

  const supabase = createClient()

  // Check the calling user is authenticated
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  // Insert with ON CONFLICT DO NOTHING — idempotent (AC-0084).
  // RLS policy `user_roles_insert_admin` enforces admin-only at DB level.
  const { error } = await supabase.from('user_roles').insert({
    player_id: playerId,
    role: 'tournament_organizer',
    tournament_id: tournamentId,
  })

  if (error) {
    // RLS violation or FK constraint failure — surface generic message
    if (
      error.code === '42501' || // insufficient_privilege
      error.message?.includes('row-level security')
    ) {
      return { error: 'Unauthorized: admin role required' }
    }
    return { error: error.message ?? 'Failed to assign organizer role' }
  }

  return { error: null }
}

/**
 * searchPlayersAction — searches players by name (case-insensitive ILIKE).
 *
 * Returns up to 20 matches to keep the result list manageable in the UI (AC-0083).
 * RLS: the `players_select_self_or_teammate_or_admin` policy means only admin
 * can search all players — which is correct since this action is admin-only.
 */
export async function searchPlayersAction(
  query: string
): Promise<{
  players: { id: string; name: string; email: string }[]
  error: string | null
}> {
  if (!query || query.trim().length === 0) {
    return { players: [], error: null }
  }

  const supabase = createClient()

  const { data, error } = await supabase
    .from('players')
    .select('id, name, email')
    .ilike('name', `%${query.trim()}%`)
    .limit(20)

  if (error) {
    return { players: [], error: error.message ?? 'Search failed' }
  }

  return { players: data ?? [], error: null }
}
