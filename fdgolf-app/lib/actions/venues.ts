'use server'

import { createClient } from '@/lib/supabase/server'

type VenueState = { error: string | null; id?: string }

export async function createVenueAction(
  _prev: VenueState,
  formData: FormData
): Promise<VenueState> {
  const name           = (formData.get('name') as string | null)?.trim() ?? ''
  const address1       = (formData.get('address1') as string | null)?.trim() || null
  const address2       = (formData.get('address2') as string | null)?.trim() || null
  const city           = (formData.get('city') as string | null)?.trim() || null
  const state_province = (formData.get('state_province') as string | null)?.trim() || null
  const zip_postal     = (formData.get('zip_postal') as string | null)?.trim() || null

  if (!name) return { error: 'Venue name is required.' }

  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized.' }

  const { data, error } = await supabase
    .from('venues')
    .insert({ name, address1, address2, city, state_province, zip_postal })
    .select('id')
    .single()

  if (error) return { error: error.message }
  return { error: null, id: data.id }
}

export async function updateVenueAction(
  venueId: string,
  _prev: VenueState,
  formData: FormData
): Promise<VenueState> {
  const name           = (formData.get('name') as string | null)?.trim() ?? ''
  const address1       = (formData.get('address1') as string | null)?.trim() || null
  const address2       = (formData.get('address2') as string | null)?.trim() || null
  const city           = (formData.get('city') as string | null)?.trim() || null
  const state_province = (formData.get('state_province') as string | null)?.trim() || null
  const zip_postal     = (formData.get('zip_postal') as string | null)?.trim() || null

  if (!name) return { error: 'Venue name is required.' }

  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized.' }

  const { error } = await supabase
    .from('venues')
    .update({ name, address1, address2, city, state_province, zip_postal })
    .eq('id', venueId)

  return { error: error?.message ?? null }
}

export async function deleteVenueAction(
  venueId: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized.' }

  const { count } = await supabase
    .from('tournaments')
    .select('id', { count: 'exact', head: true })
    .eq('venue_id', venueId)

  if ((count ?? 0) > 0) {
    return { error: `Cannot delete: ${count} tournament(s) reference this venue.` }
  }

  const { error } = await supabase.from('venues').delete().eq('id', venueId)
  return { error: error?.message ?? null }
}
