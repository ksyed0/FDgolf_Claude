'use server'
import { createServiceClient } from '@/lib/supabase/service'

export type TeamRow = {
  id: string
  tournament_id: string
  name: string
  captain_player_id: string | null
  join_code: string
  start_hole: number | null
  created_at: string
  team_size: number
}

export async function createTeam(
  tournamentId: string,
  name: string,
  captainPlayerId: string,
  teamSize: number = 4
): Promise<{ data: TeamRow | null; error: string | null }> {
  if (teamSize < 2 || teamSize > 5)
    return { data: null, error: 'Team size must be between 2 and 5' }
  const supabase = createServiceClient()
  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .insert({
      tournament_id: tournamentId,
      name,
      captain_player_id: captainPlayerId,
      team_size: teamSize,
    })
    .select()
    .single()
  if (teamErr || !team) return { data: null, error: teamErr?.message ?? 'Failed to create team' }

  const { error: memberErr } = await supabase
    .from('team_members')
    .insert({ team_id: team.id, player_id: captainPlayerId, is_captain: true })
  if (memberErr) return { data: null, error: memberErr.message }
  return { data: team, error: null }
}

export async function joinTeamByCode(
  joinCode: string,
  playerId: string
): Promise<{ data: TeamRow | null; error: string | null }> {
  const supabase = createServiceClient()
  const { data: team } = await supabase
    .from('teams')
    .select()
    .eq('join_code', joinCode.toUpperCase())
    .maybeSingle()
  if (!team) return { data: null, error: 'Team code not found' }

  const { count } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', team.id)
  if ((count ?? 0) >= (team.team_size ?? 4)) return { data: null, error: 'This team is full' }

  const { error } = await supabase
    .from('team_members')
    .insert({ team_id: team.id, player_id: playerId, is_captain: false })
  if (error && error.code !== '23505') return { data: null, error: error.message }
  return { data: team, error: null }
}

export async function promoteNextCaptain(teamId: string, departingPlayerId: string): Promise<void> {
  const supabase = createServiceClient()
  const { data: next } = await supabase
    .from('team_members')
    .select('player_id')
    .eq('team_id', teamId)
    .neq('player_id', departingPlayerId)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!next) return
  await supabase
    .from('team_members')
    .update({ is_captain: true })
    .eq('team_id', teamId)
    .eq('player_id', next.player_id)
}

export async function switchTeam(
  playerId: string,
  newJoinCode: string,
  oldTeamId: string
): Promise<{ data: TeamRow | null; error: string | null }> {
  const supabase = createServiceClient()
  const { data: newTeam } = await supabase
    .from('teams')
    .select()
    .eq('join_code', newJoinCode.toUpperCase())
    .maybeSingle()
  if (!newTeam) return { data: null, error: 'Team code not found' }

  const { count } = await supabase
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', newTeam.id)
  if ((count ?? 0) >= (newTeam.team_size ?? 4)) return { data: null, error: 'This team is full' }

  // Check if departing player is captain on old team (via is_captain, not captain_player_id)
  const { data: membership } = await supabase
    .from('team_members')
    .select('is_captain')
    .eq('team_id', oldTeamId)
    .eq('player_id', playerId)
    .single()

  await supabase.from('team_members').delete().eq('team_id', oldTeamId).eq('player_id', playerId)

  const { data: remaining } = await supabase
    .from('team_members')
    .select('player_id')
    .eq('team_id', oldTeamId)
    .order('joined_at', { ascending: true })

  if (!remaining || remaining.length === 0) {
    await supabase.from('teams').delete().eq('id', oldTeamId)
  } else if (membership?.is_captain) {
    await supabase
      .from('team_members')
      .update({ is_captain: true })
      .eq('team_id', oldTeamId)
      .eq('player_id', remaining[0].player_id)
  }

  const { error } = await supabase
    .from('team_members')
    .insert({ team_id: newTeam.id, player_id: playerId, is_captain: false })
  if (error && error.code !== '23505') return { data: null, error: error.message }
  return { data: newTeam, error: null }
}

export async function listTeams(tournamentId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('teams')
    .select(
      `id, name, join_code, start_hole, captain_player_id, team_size,
      team_members(player_id, joined_at, is_captain, players(full_name, email, company, title))`
    )
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true })
  if (error) return { data: null, error: error.message }
  return { data, error: null }
}
