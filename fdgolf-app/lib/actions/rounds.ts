'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type CreateRoundParams = {
  tournamentId: string
  teamId: string
  startHole: number
  bagClubs: string[]
  firstPlayerId: string
}

export async function createRoundAction(params: CreateRoundParams): Promise<{ error: string }> {
  const supabase = await createClient()

  // 1. Resolve authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // 2. Resolve player record
  const { data: player } = await supabase
    .from('players')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!player) return { error: 'Player record not found' }

  // 3. Guard: tournament must be active
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, status')
    .eq('id', params.tournamentId)
    .single()
  if (!tournament || tournament.status !== 'active') {
    return { error: 'Tournament is not active' }
  }

  // 4. Guard: no existing round
  const { data: existing } = await supabase
    .from('rounds')
    .select('id')
    .eq('tournament_id', params.tournamentId)
    .eq('player_id', player.id)
    .single()
  if (existing) return { error: 'Round already exists for this player' }

  // 5. Insert round
  // redirect() throws internally — must NOT be inside try/catch
  const { data: newRound } = await supabase
    .from('rounds')
    .insert({
      tournament_id: params.tournamentId,
      player_id: player.id,
      team_id: params.teamId,
      start_hole: params.startHole,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      bag_clubs: params.bagClubs,
      first_player_id: params.firstPlayerId,
    })
    .select('id')
    .single()

  if (!newRound) return { error: 'Failed to create round' }

  redirect(`/round/${newRound.id}`)
}
