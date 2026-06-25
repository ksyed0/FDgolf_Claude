'use server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { promoteNextCaptain } from '@/lib/actions/teams'

export type PlayerInput = {
  email: string
  full_name: string
  phone?: string | null
  handicap?: number | null
  company?: string | null
  title?: string | null
  dob?: string | null
  gender?: string | null
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

// ─── Player management actions (US-0068, US-0070, US-0073) ───────────────────

export type PlayerFilter = 'unassigned' | 'withdrawn'

export type PlayerSearchRow = {
  id: string
  full_name: string
  email: string
  phone: string | null
  company: string | null
  title: string | null
  handicap: number | null
  registration_status: string
  team_id: string | null
  team_name: string | null
  is_captain: boolean
}

const PAGE_SIZE = 50

export async function searchPlayersAction(
  query: string,
  tournamentId: string,
  page: number,
  filters: PlayerFilter[]
): Promise<{ data: PlayerSearchRow[]; total: number; error: string | null }> {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { data: [], total: 0, error: 'Unauthorized' }

  const db = createServiceClient()
  let q = db
    .from('tournament_registrations')
    .select(
      `player:players!inner(id, full_name, email, phone, company, title, handicap, deleted_at),
       status,
       team_member:team_members(team_id, is_captain, teams(name))`,
      { count: 'exact' }
    )
    .eq('tournament_id', tournamentId)
    .is('players.deleted_at', null)

  if (query.trim()) {
    const q2 = query.trim()
    q = q.or(`full_name.ilike.%${q2}%,email.ilike.%${q2}%,company.ilike.%${q2}%`, {
      foreignTable: 'players',
    })
  }

  if (filters.includes('withdrawn')) {
    q = q.eq('status', 'withdrawn')
  }

  q = q.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

  const { data, count, error } = await q
  if (error) return { data: [], total: 0, error: error.message }

  const rows: PlayerSearchRow[] = (data ?? []).map((r) => {
    const p = r.player as unknown as PlayerSearchRow & { deleted_at: string | null }
    const tm = (
      r.team_member as unknown as Array<{
        team_id: string
        is_captain: boolean
        teams: { name: string } | null
      }> | null
    )?.[0]
    return {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
      company: p.company,
      title: p.title,
      handicap: p.handicap,
      registration_status: r.status,
      team_id: tm?.team_id ?? null,
      team_name: tm?.teams?.name ?? null,
      is_captain: tm?.is_captain ?? false,
    }
  })

  // NOTE: The 'unassigned' filter is applied in-memory after pagination because
  // team_member is a left-join array and Supabase does not support a DB-level
  // .is(null) filter on an embedded relation count. As a result, when this filter
  // is active, `total` reflects the pre-filter (paginated slice) count rather than
  // the true count of unassigned players. Callers should treat `total` as an upper
  // bound when the 'unassigned' filter is active.
  const filtered = filters.includes('unassigned') ? rows.filter((r) => !r.team_id) : rows

  return { data: filtered, total: count ?? 0, error: null }
}

export async function deletePlayerAction(
  playerId: string,
  tournamentId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized' }

  const db = createServiceClient()

  // Scoped to the given tournament so an active round in another event
  // does not block removal from this one.
  const { data: activeRound } = await db
    .from('rounds')
    .select('id')
    .eq('player_id', playerId)
    .eq('tournament_id', tournamentId)
    .eq('status', 'in_progress')
    .maybeSingle()

  if (activeRound) {
    return { error: 'Player has an active round — end the round before removing' }
  }

  const { error: playerErr } = await db
    .from('players')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', playerId)
  if (playerErr) return { error: playerErr.message }

  const { error: regErr } = await db
    .from('tournament_registrations')
    .update({ status: 'withdrawn' })
    .eq('player_id', playerId)
    .eq('tournament_id', tournamentId)
  if (regErr) return { error: regErr.message }

  // Clean up team membership for this tournament.
  // If the player is a captain, promote the next member before removing.
  const { data: membership } = await db
    .from('team_members')
    .select('team_id, is_captain')
    .eq('player_id', playerId)
    .maybeSingle()

  if (membership?.team_id) {
    if (membership.is_captain) {
      await promoteNextCaptain(membership.team_id, playerId)
    }
    await db.from('team_members').delete().eq('player_id', playerId)
  }

  return { error: null }
}

export async function assignTeamAction(
  playerId: string,
  newTeamId: string | null,
  tournamentId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized' }

  const db = createServiceClient()

  // Find current membership
  const { data: currentMembership } = await db
    .from('team_members')
    .select('team_id, is_captain')
    .eq('player_id', playerId)
    .maybeSingle()

  // Promote next captain before removing if departing player is captain
  if (currentMembership?.is_captain && currentMembership.team_id) {
    await promoteNextCaptain(currentMembership.team_id, playerId)
  }

  // Remove from current team
  if (currentMembership?.team_id) {
    await db.from('team_members').delete().eq('player_id', playerId)
  }

  if (!newTeamId) return { error: null }

  // Validate capacity of new team
  const { data: newTeam } = await db.from('teams').select('team_size').eq('id', newTeamId).single()

  const { count } = await db
    .from('team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', newTeamId)

  if ((count ?? 0) >= (newTeam?.team_size ?? 4)) {
    return { error: `This team is full (${count}/${newTeam?.team_size ?? 4})` }
  }

  const { error: insertErr } = await db
    .from('team_members')
    .insert({ team_id: newTeamId, player_id: playerId, is_captain: false })
  if (insertErr) return { error: insertErr.message }

  return { error: null }
}
