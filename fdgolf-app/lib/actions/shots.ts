'use server'

import { createClient } from '@/lib/supabase/server'
import type { RehitOrigin, ShotOutcome } from '@/lib/round/types'

export type CreateShotInput = {
  roundId: string
  holeNumber: number
  shotNumber: number
  playerId: string
  clubId: string | null
  originLat: number | null
  originLng: number | null
  outcome: ShotOutcome
  strokeCount: 0 | 1 | 2
  accuracyM: number | null
  rehitFromShotId: string | null
  rehitOrigin: RehitOrigin | null
}

export type ShotActionResult =
  | { ok: true; serverId: string }
  | { ok: false; code: 'unique_violation' | 'network' | 'denied' }

export async function createShotAction(input: CreateShotInput): Promise<ShotActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, code: 'denied' }

  const { data, error } = await supabase
    .from('shots')
    .insert({
      round_id: input.roundId,
      hole_number: input.holeNumber,
      shot_number: input.shotNumber,
      club_id: input.clubId,
      origin_lat: input.originLat,
      origin_lng: input.originLng,
      outcome: input.outcome,
      stroke_count: input.strokeCount,
      accuracy_m: input.accuracyM,
      rehit_from_shot_id: input.rehitFromShotId,
      rehit_origin: input.rehitOrigin,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { ok: false, code: 'unique_violation' }
    return { ok: false, code: 'network' }
  }
  return { ok: true, serverId: data!.id }
}

export type EditShotInput = {
  shotId: string
  clubId: string | null
  outcome: ShotOutcome
  strokeCount: 0 | 1 | 2
  originLat: number | null
  originLng: number | null
}

export async function editShotAction(input: EditShotInput): Promise<ShotActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, code: 'denied' }

  // 1. Read current state for the before-image (AC-0161).
  const { data: before, error: readErr } = await supabase
    .from('shots')
    .select('id, club_id, outcome, origin_lat, origin_lng, stroke_count')
    .eq('id', input.shotId)
    .single()
  if (readErr || !before) return { ok: false, code: 'network' }

  const after = {
    club_id: input.clubId,
    outcome: input.outcome,
    stroke_count: input.strokeCount,
    origin_lat: input.originLat,
    origin_lng: input.originLng,
    updated_by: user.id,
  }

  // 2. Audit row (AC-0161). shot_edits insert is admin-gated by RLS; in flexible mode the
  //    edit is performed by the round owner/organizer whose policy permits the shots UPDATE.
  const { error: auditErr } = await supabase
    .from('shot_edits')
    .insert({ shot_id: input.shotId, edited_by: user.id, before_state: before, after_state: after })
  if (auditErr) return { ok: false, code: 'network' }

  // 3. Apply the edit (AC-0160/0162). trg_shots_recompute re-derives scores (AC-0163).
  const { error: updErr } = await supabase.from('shots').update(after).eq('id', input.shotId)
  if (updErr) return { ok: false, code: 'network' }

  return { ok: true, serverId: input.shotId }
}
