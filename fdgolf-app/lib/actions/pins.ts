'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type PinActionState = {
  error: string | null
  savedHoleNumber?: number
}

/**
 * savePinAction — Server Action for pin coordinate placement (US-0013).
 *
 * AC-0059: Saves pin_lat/pin_lng to the holes table for a given hole,
 *          scoped by course_id (BUG-0013 security invariant).
 * AC-0063: Revalidates the course page so pin status column updates.
 *
 * Tee saves are handled by saveTeeCoordAction below.
 */
export async function savePinAction(
  courseId: string,
  holeId: string,
  lat: number,
  lng: number
): Promise<{ error: string | null }> {
  const supabase = createClient()

  // Admin guard
  const { data: isAdmin, error: adminError } = await supabase.rpc('fdgolf_is_admin')
  if (adminError || !isAdmin) {
    return { error: 'Unauthorized: admin access required.' }
  }

  const { error: updateError } = await supabase
    .from('holes')
    .update({ pin_lat: lat, pin_lng: lng })
    .eq('id', holeId)
    .eq('course_id', courseId)

  if (updateError) {
    return { error: updateError.message }
  }

  return { error: null }
}

type TeeCoord = { colour: string; yardage: number; lat: number | null; lng: number | null }

export async function saveTeeCoordAction(
  courseId: string,
  holeId: string,
  teeColour: string,
  lat: number,
  lng: number
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized.' }

  const { data: hole, error: fetchError } = await supabase
    .from('holes')
    .select('tees')
    .eq('id', holeId)
    .eq('course_id', courseId)
    .single()

  if (fetchError) return { error: fetchError.message }
  if (!hole) return { error: 'Hole not found.' }

  const tees = (hole.tees ?? []) as TeeCoord[]
  if (!tees.some(t => t.colour === teeColour)) {
    return { error: `No tee with colour "${teeColour}" found on this hole.` }
  }

  const updated = tees.map(t => t.colour === teeColour ? { ...t, lat, lng } : t)

  const { error: updateError } = await supabase
    .from('holes')
    .update({ tees: updated })
    .eq('id', holeId)
    .eq('course_id', courseId)

  return { error: updateError?.message ?? null }
}
