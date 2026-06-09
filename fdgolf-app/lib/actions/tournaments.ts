'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { generateSlug } from '@/lib/utils/slug'

type ActionState = { error: string | null }

/**
 * createTournamentAction — Server Action for tournament creation (US-0009).
 *
 * Validates required fields, generates a slug from name, inserts the row
 * with status='draft', and redirects to /admin/tournaments/[slug].
 *
 * AC-0044: name, starts_at, venue, format, start_style, holes_count required.
 * AC-0045: status always set to 'draft' on creation.
 * AC-0046: slug auto-generated from name.
 */
export async function createTournamentAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const name       = (formData.get('name')        as string | null)?.trim() ?? ''
  const venue      = (formData.get('venue')       as string | null)?.trim() ?? ''
  const starts_at  = (formData.get('starts_at')   as string | null)?.trim() ?? ''
  const format     = (formData.get('format')      as string | null) ?? 'best_ball'
  const start_style = (formData.get('start_style') as string | null) ?? 'shotgun'
  const holes_count = parseInt(formData.get('holes_count') as string ?? '18', 10)

  if (!name)      return { error: 'Tournament name is required.' }
  if (!venue)     return { error: 'Venue is required.' }
  if (!starts_at) return { error: 'Start date and time are required.' }

  const slug = generateSlug(name)
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      name,
      slug,
      venue,
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
