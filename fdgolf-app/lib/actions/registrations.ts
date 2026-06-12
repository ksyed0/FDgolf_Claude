'use server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

export async function createRegistration(
  tournamentId: string,
  playerId: string,
  status: 'invited' | 'registered' = 'invited'
): Promise<{ error: string | null }> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('tournament_registrations')
    .insert({ tournament_id: tournamentId, player_id: playerId, status })
  if (error && error.code !== '23505') return { error: error.message }
  return { error: null }
}

export async function markRegistered(
  tournamentId: string,
  playerId: string
): Promise<{ error: string | null }> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('tournament_registrations')
    .update({ status: 'registered', registered_at: new Date().toISOString() })
    .eq('tournament_id', tournamentId)
    .eq('player_id', playerId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function updateRegistrationStatus(
  tournamentId: string,
  playerId: string,
  status: 'registered' | 'withdrawn'
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized' }

  const svc = createServiceClient()
  const { error } = await svc
    .from('tournament_registrations')
    .update({ status })
    .eq('tournament_id', tournamentId)
    .eq('player_id', playerId)
  if (error) return { error: error.message }
  return { error: null }
}
