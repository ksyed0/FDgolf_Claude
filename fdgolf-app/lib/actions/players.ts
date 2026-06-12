'use server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

export type PlayerInput = {
  email: string
  full_name: string
  phone?: string | null
  handicap?: number | null
  company?: string | null
  title?: string | null
}

export type PlayerRow = PlayerInput & {
  id: string
  user_id: string | null
  created_at: string
}

export async function createPlayer(
  input: PlayerInput
): Promise<{ data: PlayerRow | null; error: string | null }> {
  const supabase = createServiceClient()
  const payload = { ...input, email: input.email.toLowerCase() }
  const { data, error } = await supabase
    .from('players')
    .upsert(payload, { onConflict: 'email' })
    .select()
    .single()
  if (error) return { data: null, error: error.message }
  return { data, error: null }
}

export async function updatePlayer(
  playerId: string,
  updates: Partial<Omit<PlayerInput, 'email'>>
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  const { data: player } = await supabase
    .from('players')
    .select('user_id')
    .eq('id', playerId)
    .single()

  if (!isAdmin && player?.user_id !== user.id) return { error: 'Unauthorized' }

  const { error } = await supabase.from('players').update(updates).eq('id', playerId)
  if (error) return { error: error.message }
  return { error: null }
}

export async function getPlayerByEmail(
  email: string
): Promise<{ data: PlayerRow | null; error: string | null }> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('players')
    .select()
    .eq('email', email.toLowerCase())
    .maybeSingle()
  if (error) return { data: null, error: error.message }
  return { data, error: null }
}
