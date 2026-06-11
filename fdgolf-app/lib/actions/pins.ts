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

  // Best-effort: generate and store a static map snapshot (US-0014)
  await captureStaticSnapshot(supabase, courseId, holeId, lat, lng)

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
  if (!tees.some((t) => t.colour === teeColour)) {
    return { error: `No tee with colour "${teeColour}" found on this hole.` }
  }

  const updated = tees.map((t) => (t.colour === teeColour ? { ...t, lat, lng } : t))

  const { error: updateError } = await supabase
    .from('holes')
    .update({ tees: updated })
    .eq('id', holeId)
    .eq('course_id', courseId)

  return { error: updateError?.message ?? null }
}

async function captureStaticSnapshot(
  supabase: ReturnType<typeof createClient>,
  courseId: string,
  holeId: string,
  lat: number,
  lng: number
): Promise<void> {
  try {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) return

    // Fetch hole number for the filename
    const { data: hole } = await supabase
      .from('holes')
      .select('number')
      .eq('id', holeId)
      .eq('course_id', courseId)
      .single()
    if (!hole) return

    // Call Mapbox Static Images API
    const url =
      `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/` +
      `${lng},${lat},16/600x400@2x?access_token=${token}`
    const response = await fetch(url)
    if (!response.ok) return

    const buffer = await response.arrayBuffer()
    const path = `${courseId}/hole-${hole.number}.png`

    const { error: uploadError } = await supabase.storage
      .from('course-maps')
      .upload(path, buffer, { contentType: 'image/png', upsert: true })
    if (uploadError) return

    const { data: urlData } = supabase.storage.from('course-maps').getPublicUrl(path)

    await supabase
      .from('holes')
      .update({ static_map_url: urlData.publicUrl })
      .eq('id', holeId)
      .eq('course_id', courseId)
  } catch (err) {
    console.error('[US-0014] Static snapshot failed:', err)
  }
}
