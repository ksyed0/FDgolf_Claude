import { redirect } from 'next/navigation'
import { createClient } from './server'

/**
 * Asserts the caller is a system admin. Redirects to / otherwise.
 * Use for pages that are system-admin-only (create tournament, manage venues, etc.).
 */
export async function requireSystemAdmin(): Promise<void> {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/')
}

/**
 * Asserts the caller is either a system admin OR a tournament organizer for the
 * given tournament. Redirects to / otherwise.
 *
 * Returns { isAdmin } so callers can conditionally show system-admin-only UI
 * (e.g. the "Assign organizer" section is only visible to system admins).
 */
export async function requireTournamentAccess(tournamentId: string): Promise<{ isAdmin: boolean }> {
  const supabase = await createClient()
  const [{ data: isAdmin }, { data: isOrganizer }] = await Promise.all([
    supabase.rpc('fdgolf_is_admin'),
    supabase.rpc('fdgolf_is_organizer_for', { p_tournament_id: tournamentId }),
  ])
  if (!isAdmin && !isOrganizer) redirect('/')
  return { isAdmin: !!isAdmin }
}
