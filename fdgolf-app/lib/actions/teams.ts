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
}

export async function createTeam(
  tournamentId: string,
  name: string,
  captainPlayerId: string
): Promise<{ data: TeamRow | null; error: string | null }> {
  const supabase = createServiceClient()
  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .insert({ tournament_id: tournamentId, name, captain_player_id: captainPlayerId })
    .select()
    .single()
  if (teamErr || !team) return { data: null, error: teamErr?.message ?? 'Failed to create team' }

  const { error: memberErr } = await supabase
    .from('team_members')
    .insert({ team_id: team.id, player_id: captainPlayerId })
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
  if ((count ?? 0) >= 5) return { data: null, error: 'This team is full' }

  const { error } = await supabase
    .from('team_members')
    .insert({ team_id: team.id, player_id: playerId })
  if (error && error.code !== '23505') return { data: null, error: error.message }
  return { data: team, error: null }
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
  if ((count ?? 0) >= 5) return { data: null, error: 'This team is full' }

  const { data: oldTeam } = await supabase
    .from('teams')
    .select('captain_player_id')
    .eq('id', oldTeamId)
    .single()

  await supabase.from('team_members').delete().eq('team_id', oldTeamId).eq('player_id', playerId)

  const { data: remaining } = await supabase
    .from('team_members')
    .select('player_id')
    .eq('team_id', oldTeamId)
    .order('joined_at', { ascending: true })

  if (!remaining || remaining.length === 0) {
    await supabase.from('teams').delete().eq('id', oldTeamId)
  } else if (oldTeam?.captain_player_id === playerId) {
    await supabase
      .from('teams')
      .update({ captain_player_id: remaining[0].player_id })
      .eq('id', oldTeamId)
  }

  const { error } = await supabase
    .from('team_members')
    .insert({ team_id: newTeam.id, player_id: playerId })
  if (error && error.code !== '23505') return { data: null, error: error.message }
  return { data: newTeam, error: null }
}

export async function listTeams(tournamentId: string) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('teams')
    .select(
      `id, name, join_code, start_hole, captain_player_id,
      team_members(player_id, joined_at, players(full_name, email, company, title))`
    )
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true })
  if (error) return { data: null, error: error.message }
  return { data, error: null }
}
