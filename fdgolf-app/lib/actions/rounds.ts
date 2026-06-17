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

const CLAIM_TTL_MS = 60_000 // D3: 60s expiry, 20s heartbeat (caller-driven)

export type ClaimResult =
  | { ok: true }
  | { ok: false; code: 'denied' | 'claimed_by_other' | 'network' }

export async function claimRoundAction(roundId: string): Promise<ClaimResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, code: 'denied' }

  const { data: player } = await supabase
    .from('players')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!player) return { ok: false, code: 'denied' }

  const now = new Date()
  const expiry = new Date(now.getTime() + CLAIM_TTL_MS).toISOString()
  const nowIso = now.toISOString()

  // Atomic conditional update: only wins if no live claim exists OR we already
  // hold the claim (heartbeat/renew). Returns 0 rows when another recorder holds
  // a non-expired claim, which is the only losing case.
  const { data, error } = await supabase
    .from('rounds')
    .update({ recorded_by: player.id, recording_expires_at: expiry })
    .eq('id', roundId)
    .or(`recorded_by.is.null,recorded_by.eq.${player.id},recording_expires_at.lt.${nowIso}`)
    .select('id')

  if (error) return { ok: false, code: 'network' }
  if (!data || data.length === 0) return { ok: false, code: 'claimed_by_other' }
  return { ok: true }
}

export type CompleteResult =
  | { ok: true; completed: boolean }
  | { ok: false; code: 'denied' | 'network' }

/** AC-0176: when all 18 hole_scores are final, set status=completed + completed_at. */
export async function completeRoundAction(roundId: string): Promise<CompleteResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, code: 'denied' }

  const { count, error: countErr } = await supabase
    .from('hole_scores')
    .select('id', { count: 'exact', head: true })
    .eq('round_id', roundId)
    .eq('status', 'final')
  if (countErr) return { ok: false, code: 'network' }
  if ((count ?? 0) < 18) return { ok: true, completed: false }

  const { data: updated, error: updErr } = await supabase
    .from('rounds')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', roundId)
    .select('id')
    .maybeSingle()
  if (updErr) return { ok: false, code: 'network' }
  // 0 rows = RLS blocked the update or round not found — do not report completed.
  if (!updated) return { ok: true, completed: false }
  return { ok: true, completed: true }
}
