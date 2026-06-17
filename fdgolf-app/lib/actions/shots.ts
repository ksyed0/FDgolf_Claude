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
