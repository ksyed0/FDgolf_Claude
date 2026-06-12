'use server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { sendInviteEmail } from './invitations'

type ImportResult = {
  imported: number
  invited: number
  errors: { row: number; reason: string }[]
}

export async function importPlayersFromCSV(
  tournamentId: string,
  slug: string,
  tournamentName: string,
  csvText: string
): Promise<{ data: ImportResult | null; error: string | null }> {
  const session = await createClient()
  const { data: isAdmin } = await session.rpc('fdgolf_is_admin')
  if (!isAdmin) return { data: null, error: 'Unauthorized' }

  const supabase = createServiceClient()
  const lines = csvText.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return { data: null, error: 'CSV is empty' }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const missing = ['full_name', 'email'].filter((h) => !headers.includes(h))
  if (missing.length > 0) {
    return { data: null, error: `Missing required columns: ${missing.join(', ')}` }
  }

  const rows = lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim())
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = vals[i] ?? ''
    })
    return obj
  })

  // Build team map
  const teamMap = new Map<string, { id: string; captainSet: boolean }>()
  for (const row of rows) {
    const teamName = row.team?.trim()
    if (!teamName || teamMap.has(teamName)) continue
    const { data: existing } = await supabase
      .from('teams')
      .select('id, captain_player_id')
      .eq('tournament_id', tournamentId)
      .eq('name', teamName)
      .maybeSingle()
    if (existing) {
      teamMap.set(teamName, { id: existing.id, captainSet: !!existing.captain_player_id })
    } else {
      const { data: newTeam } = await supabase
        .from('teams')
        .insert({ tournament_id: tournamentId, name: teamName })
        .select('id')
        .single()
      if (newTeam) teamMap.set(teamName, { id: newTeam.id, captainSet: false })
    }
  }

  const result: ImportResult = { imported: 0, invited: 0, errors: [] }
  const toInvite: { email: string; fullName: string; token: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2
    if (!row.full_name || !row.email) {
      result.errors.push({ row: rowNum, reason: 'Missing full_name or email' })
      continue
    }
    const { data: player, error: pErr } = await supabase
      .from('players')
      .upsert(
        {
          email: row.email.toLowerCase(),
          full_name: row.full_name,
          phone: row.phone || null,
          handicap: row.handicap ? parseFloat(row.handicap) : null,
          company: row.company || null,
          title: row.title || null,
        },
        { onConflict: 'email' }
      )
      .select('id')
      .single()
    if (pErr || !player) {
      result.errors.push({ row: rowNum, reason: pErr?.message ?? 'Player upsert failed' })
      continue
    }
    result.imported++

    const teamName = row.team?.trim()
    if (teamName && teamMap.has(teamName)) {
      const entry = teamMap.get(teamName)!
      try {
        await supabase.from('team_members').insert({ team_id: entry.id, player_id: player.id })
      } catch {
        /* ignore duplicate */
      }
      if (!entry.captainSet) {
        await supabase.from('teams').update({ captain_player_id: player.id }).eq('id', entry.id)
        entry.captainSet = true
      }
    }

    try {
      await supabase
        .from('tournament_registrations')
        .insert({ tournament_id: tournamentId, player_id: player.id, status: 'invited' })
    } catch {
      /* ignore duplicate */
    }

    const { data: inv } = await supabase
      .from('player_invitations')
      .insert({ player_id: player.id, tournament_id: tournamentId })
      .select('token')
      .single()
    if (inv) toInvite.push({ email: row.email, fullName: row.full_name, token: inv.token })
  }

  const emailResults = await Promise.all(
    toInvite.map(({ email, fullName, token }) =>
      sendInviteEmail(email, fullName, tournamentName, slug, token)
        .then((r) => (r.error ? { email, error: r.error } : null))
        .catch((e: unknown) => ({ email, error: String(e) }))
    )
  )
  for (const r of emailResults) {
    if (r) result.errors.push({ row: -1, reason: `Email failed for ${r.email}: ${r.error}` })
    else result.invited++
  }

  return { data: result, error: null }
}
