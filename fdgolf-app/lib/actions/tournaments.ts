'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { generateSlug } from '@/lib/utils/slug'

type ActionState = { error: string | null }

/**
 * checkSlugAvailableAction — Server Action for slug uniqueness check (US-0010).
 *
 * AC-0048: Returns { available: true } if no tournament uses the given slug.
 */
export async function checkSlugAvailableAction(slug: string): Promise<{ available: boolean }> {
  if (!slug) return { available: false }
  const supabase = await createClient()
  const { data } = await supabase.from('tournaments').select('id').eq('slug', slug).maybeSingle()
  return { available: data === null }
}

/**
 * createTournamentAction — Server Action for tournament creation (US-0009).
 *
 * Validates required fields, generates a slug from name (or uses slug_override),
 * inserts the row with status='draft', and redirects to /admin/tournaments/[slug].
 *
 * AC-0044: name, starts_at, venue, format, start_style, holes_count required.
 * AC-0045: status always set to 'draft' on creation.
 * AC-0046: slug auto-generated from name.
 * AC-0047/AC-0049: slug_override used if provided and valid (a-z, 0-9, hyphens only).
 */
export async function createTournamentAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const venue_id = (formData.get('venue_id') as string | null)?.trim() || null
  const course_id = (formData.get('course_id') as string | null)?.trim() || null
  const starts_at = (formData.get('starts_at') as string | null)?.trim() ?? ''
  const format = (formData.get('format') as string | null) ?? 'best_ball'
  const start_style = (formData.get('start_style') as string | null) ?? 'shotgun'
  const holes_count = parseInt((formData.get('holes_count') as string) ?? '18', 10)
  const slugOverride = (formData.get('slug_override') as string | null)?.trim() ?? ''

  if (!name) return { error: 'Tournament name is required.' }
  if (!starts_at) return { error: 'Start date and time are required.' }

  if (slugOverride && !/^[a-z0-9-]+$/.test(slugOverride)) {
    return { error: 'Slug may only contain lowercase letters, digits, and hyphens.' }
  }

  const slug = slugOverride || generateSlug(name)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      name,
      slug,
      venue_id,
      course_id,
      starts_at: new Date(starts_at).toISOString(),
      format,
      start_style,
      holes_count,
      status: 'draft',
      created_by: user?.id ?? null,
    })
    .select('slug')
    .single()

  if (error) {
    return { error: error.message }
  }

  // redirect() throws internally — must not be inside try/catch
  redirect(`/admin/tournaments/${data.slug}`)
}

/**
 * updateTournamentAction — Server Action for editing an existing tournament.
 *
 * Does NOT update slug or status — those are managed separately.
 * Admin guard is checked first before any field extraction.
 */
export async function updateTournamentAction(
  tournamentId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized.' }

  const name = (formData.get('name') as string | null)?.trim() ?? ''
  if (!name) return { error: 'Tournament name is required.' }

  const venueId = (formData.get('venue_id') as string | null)?.trim() || null
  const courseId = (formData.get('course_id') as string | null)?.trim() || null
  const startsAt = (formData.get('starts_at') as string | null)?.trim() || null
  const format = (formData.get('format') as string | null)?.trim() || null
  const startStyle = (formData.get('start_style') as string | null)?.trim() || null
  const holesCount = formData.get('holes_count')
    ? parseInt(formData.get('holes_count') as string, 10)
    : null

  const { error } = await supabase
    .from('tournaments')
    .update({
      name,
      venue_id: venueId,
      course_id: courseId,
      starts_at: startsAt,
      format,
      start_style: startStyle,
      holes_count: holesCount,
    })
    .eq('id', tournamentId)

  if (error) return { error: error.message }

  // fetch the slug for redirect (slug never changes)
  const { data: updated } = await supabase
    .from('tournaments')
    .select('slug')
    .eq('id', tournamentId)
    .single()

  // redirect() throws internally — must not be inside try/catch
  redirect(`/admin/tournaments/${updated?.slug}`)
}

/**
 * deleteTournamentAction — Server Action for deleting a draft tournament.
 *
 * Only tournaments with status='draft' may be deleted.
 * Admin guard is checked first.
 */
export async function deleteTournamentAction(
  tournamentId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized.' }

  const { data: tournament, error: fetchError } = await supabase
    .from('tournaments')
    .select('status')
    .eq('id', tournamentId)
    .single()

  if (fetchError) return { error: fetchError.message }
  if (!tournament) return { error: 'Tournament not found.' }
  if (tournament.status !== 'draft') return { error: 'Only draft tournaments can be deleted.' }

  const { error } = await supabase.from('tournaments').delete().eq('id', tournamentId)
  if (error) return { error: error.message }
  return { error: null }
}
