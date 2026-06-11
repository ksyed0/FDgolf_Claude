'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type PinActionState = {
  error: string | null
  savedHoleNumber?: number
}

/**
 * savePinAction — Server Action for pin/tee coordinate placement (US-0013).
 *
 * AC-0059: Saves pin_lat/pin_lng to the holes table for a given hole.
 * AC-0060: Saves tee_lat/tee_lng when mode=tee.
 * AC-0063: Revalidates the course page so pin status column updates.
 */
export async function savePinAction(
  _prevState: PinActionState,
  formData: FormData
): Promise<PinActionState> {
  const supabase = createClient()

  // Admin guard
  const { data: isAdmin, error: adminError } = await supabase.rpc('fdgolf_is_admin')
  if (adminError || !isAdmin) {
    return { error: 'Unauthorized: admin access required.' }
  }

  const hole_id    = (formData.get('hole_id')   as string | null)?.trim() ?? ''
  const lat_raw    = formData.get('lat')   as string | null
  const lng_raw    = formData.get('lng')   as string | null
  const mode       = (formData.get('mode') as string | null)?.trim() ?? 'pin'
  const tournament_slug = (formData.get('tournament_slug') as string | null)?.trim() ?? ''
  const hole_number_raw = formData.get('hole_number') as string | null

  if (!hole_id) return { error: 'hole_id is required.' }
  if (!lat_raw || !lng_raw) return { error: 'lat and lng are required.' }

  const lat = parseFloat(lat_raw)
  const lng = parseFloat(lng_raw)

  if (isNaN(lat) || isNaN(lng)) {
    return { error: 'lat and lng must be valid numbers.' }
  }

  if (lat < -90 || lat > 90) {
    return { error: 'lat must be between -90 and 90.' }
  }

  if (lng < -180 || lng > 180) {
    return { error: 'lng must be between -180 and 180.' }
  }

  if (mode !== 'pin' && mode !== 'tee') {
    return { error: 'mode must be "pin" or "tee".' }
  }

  const updateData =
    mode === 'tee'
      ? { tee_lat: lat, tee_lng: lng }
      : { pin_lat: lat, pin_lng: lng }

  const { error: updateError } = await supabase
    .from('holes')
    .update(updateData)
    .eq('id', hole_id)

  if (updateError) {
    return { error: updateError.message }
  }

  // Revalidate course page so pin status column reflects the change
  if (tournament_slug) {
    revalidatePath(`/admin/tournaments/${tournament_slug}/course`)
    revalidatePath(`/admin/tournaments/${tournament_slug}/course/pins`)
  }

  const holeNumber = hole_number_raw ? parseInt(hole_number_raw, 10) : undefined

  return {
    error: null,
    savedHoleNumber: isNaN(holeNumber ?? NaN) ? undefined : holeNumber,
  }
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
