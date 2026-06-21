import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') })

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.test'
    )
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

/** Delete a tournament and all child rows (cascades via FK) by slug. */
export async function deleteTournamentBySlug(slug: string): Promise<void> {
  const db = getServiceClient()
  const { error } = await db.from('tournaments').delete().eq('slug', slug)
  if (error) {
    console.warn(`[db-helper] Could not delete tournament "${slug}":`, error.message)
  }
}

/** Insert a minimal draft tournament; returns the created row. */
export async function createTestTournament(slug: string): Promise<{ id: string; slug: string }> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('tournaments')
    .insert({
      name: `Test Tournament ${slug}`,
      slug,
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      format: 'best_ball',
      start_style: 'shotgun',
      holes_count: 18,
      status: 'draft',
    })
    .select('id, slug')
    .single()
  if (error || !data) {
    throw new Error(`[db-helper] Could not create tournament "${slug}": ${error?.message}`)
  }
  return data
}

/** Delete a round by ID. */
export async function deleteRound(roundId: string): Promise<void> {
  const db = getServiceClient()
  await db.from('rounds').delete().eq('id', roundId)
}

/** Delete all rounds for a player in a tournament (by email + tournament slug). */
export async function deleteRoundsForPlayer(
  playerEmail: string,
  tournamentSlug: string
): Promise<void> {
  const db = getServiceClient()
  const { data: tournament } = await db
    .from('tournaments')
    .select('id')
    .eq('slug', tournamentSlug)
    .single()
  if (!tournament) return
  const { data: player } = await db.from('players').select('id').eq('email', playerEmail).single()
  if (!player) return
  await db.from('rounds').delete().eq('player_id', player.id).eq('tournament_id', tournament.id)
}

/**
 * Create a fresh in_progress round for a player in a tournament (looked up by slug).
 * Returns the round ID and the team's start hole.
 */
export async function createE2ERound(
  playerEmail: string,
  tournamentSlug: string
): Promise<{ roundId: string; startHole: number }> {
  const db = getServiceClient()

  const { data: tournament } = await db
    .from('tournaments')
    .select('id')
    .eq('slug', tournamentSlug)
    .single()
  if (!tournament) throw new Error(`Tournament not found: ${tournamentSlug}`)

  const { data: player } = await db.from('players').select('id').eq('email', playerEmail).single()
  if (!player) throw new Error(`Player not found: ${playerEmail}`)

  const { data: membership } = await db
    .from('team_members')
    .select('team_id, teams!inner(start_hole, tournament_id)')
    .eq('player_id', player.id)
    .eq('teams.tournament_id', tournament.id)
    .single()
  if (!membership) throw new Error(`Player ${playerEmail} has no team in ${tournamentSlug}`)

  const team = membership.teams as unknown as { start_hole: number }

  const { data: clubs } = await db.from('clubs').select('id').limit(8).order('display_order')
  const bagClubs = (clubs ?? []).map((c: { id: string }) => c.id)

  const { data: round, error } = await db
    .from('rounds')
    .insert({
      tournament_id: tournament.id,
      player_id: player.id,
      team_id: membership.team_id,
      start_hole: team.start_hole,
      status: 'in_progress',
      bag_clubs: bagClubs,
      first_player_id: player.id,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error || !round) throw new Error(`createE2ERound failed: ${error?.message}`)

  return { roundId: round.id, startHole: team.start_hole }
}

/**
 * Get any completed round ID with shots for the given tournament slug.
 * Returns null if no completed rounds exist.
 */
export async function getCompletedRoundWithShots(tournamentSlug: string): Promise<string | null> {
  const db = getServiceClient()

  const { data: tournament } = await db
    .from('tournaments')
    .select('id')
    .eq('slug', tournamentSlug)
    .single()
  if (!tournament) return null

  const { data: rounds } = await db
    .from('rounds')
    .select('id')
    .eq('tournament_id', tournament.id)
    .eq('status', 'completed')
    .limit(1)

  return rounds?.[0]?.id ?? null
}
