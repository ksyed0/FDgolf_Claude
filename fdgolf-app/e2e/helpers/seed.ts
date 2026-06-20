import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') })

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key)
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.test'
    )
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function createPlayer(opts: {
  email: string
  fullName: string
  userId: string
}): Promise<{ id: string }> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('players')
    .insert({ user_id: opts.userId, email: opts.email, full_name: opts.fullName })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createPlayer failed for ${opts.email}: ${error?.message}`)
  return data
}

export async function createTeam(opts: {
  tournamentId: string
  name: string
  joinCode: string
  captainPlayerId: string
  startHole: number
}): Promise<{ id: string }> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('teams')
    .insert({
      tournament_id: opts.tournamentId,
      name: opts.name,
      join_code: opts.joinCode,
      captain_player_id: opts.captainPlayerId,
      start_hole: opts.startHole,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createTeam failed for ${opts.name}: ${error?.message}`)
  return data
}

export async function addTeamMember(teamId: string, playerId: string): Promise<void> {
  const db = getServiceClient()
  const { error } = await db.from('team_members').insert({ team_id: teamId, player_id: playerId })
  if (error) throw new Error(`addTeamMember failed: ${error.message}`)
}

export async function createRound(opts: {
  tournamentId: string
  playerId: string
  teamId: string
  startHole: number
  bagClubs: string[]
  firstPlayerId: string
}): Promise<{ id: string }> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('rounds')
    .insert({
      tournament_id: opts.tournamentId,
      player_id: opts.playerId,
      team_id: opts.teamId,
      start_hole: opts.startHole,
      status: 'active',
      bag_clubs: opts.bagClubs,
      first_player_id: opts.firstPlayerId,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createRound failed: ${error?.message}`)
  return data
}

/** Resolve display names → UUIDs from the clubs table. */
export async function getClubIds(displayNames: string[]): Promise<Record<string, string>> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('clubs')
    .select('id, display_name')
    .in('display_name', displayNames)
  if (error) throw new Error(`getClubIds failed: ${error.message}`)
  return Object.fromEntries((data ?? []).map((c) => [c.display_name, c.id]))
}

/** Delete all players whose email matches a LIKE pattern (e.g. 'ksyed0+%@gmail.com'). Cascades to team_members, rounds. */
export async function deletePlayersByEmailPattern(pattern: string): Promise<void> {
  const db = getServiceClient()
  const { error } = await db.from('players').delete().like('email', pattern)
  if (error) console.warn(`deletePlayersByEmailPattern: ${error.message}`)
}
