// fdgolf-app/lib/supabase/player.ts
import { createClient } from '@/lib/supabase/server'

type Tee = { colour: string; yardage: number; lat: number | null; lng: number | null }

export type PlayerContext = {
  tournament: { id: string; name: string; slug: string; starts_at: string; status: string }
  team: { id: string; name: string; start_hole: number }
  members: Array<{ id: string; full_name: string; company: string | null }>
  currentPlayerId: string
  startingHole: {
    number: number
    par: number
    strokeIndex: number | null
    yardage: number | null
    pinLat: number | null
    pinLng: number | null
  }
  clubs: Array<{ id: string; display_name: string }>
  existingRound: { id: string; status: string } | null
}

export async function getPlayerContext(
  slug: string,
  userId: string
): Promise<PlayerContext | null> {
  const supabase = await createClient()

  // 1. Tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, slug, starts_at, status, course_id')
    .eq('slug', slug)
    .single()
  if (!tournament) return null

  // 2. Player record
  const { data: player } = await supabase
    .from('players')
    .select('id')
    .eq('user_id', userId)
    .single()
  if (!player) return null

  // 3. Team — single call joining team_members to find the player's team
  const { data: team } = await supabase
    .from('teams')
    .select('id, name, start_hole, team_members!inner(player_id)')
    .eq('tournament_id', tournament.id)
    .eq('team_members.player_id', player.id)
    .single()
  if (!team) return null

  // 4. All team members — use select() not single() — a team has 2–5 members
  const { data: memberRows } = await supabase
    .from('team_members')
    .select('player_id, players(id, full_name, company)')
    .eq('team_id', team.id)

  const members = (memberRows ?? []).map((row) => {
    const p = (Array.isArray(row.players) ? row.players[0] : row.players) as {
      id: string
      full_name: string
      company: string | null
    }
    return { id: p.id, full_name: p.full_name, company: p.company }
  })

  // 5. Starting hole (from course linked to tournament)
  const { data: hole } = await supabase
    .from('holes')
    .select('number, par, handicap, pin_lat, pin_lng, tees')
    .eq('course_id', tournament.course_id)
    .eq('number', team.start_hole)
    .single()

  const tees = (hole?.tees ?? []) as Tee[]
  const startingHole = {
    number: hole?.number ?? team.start_hole,
    par: hole?.par ?? 4,
    strokeIndex: hole?.handicap ?? null,
    yardage: tees[0]?.yardage ?? null,
    pinLat: hole?.pin_lat ?? null,
    pinLng: hole?.pin_lng ?? null,
  }

  // 6. Clubs — remove .single(), use array query
  const { data: allClubs } = await supabase
    .from('clubs')
    .select('id, display_name')
    .order('display_order')

  // tournament_clubs invariant: 0 rows = all clubs active; N rows = restricted list
  const { data: tcRows } = await supabase
    .from('tournament_clubs')
    .select('club_id')
    .eq('tournament_id', tournament.id)

  const clubs =
    !tcRows || tcRows.length === 0
      ? (allClubs ?? [])
      : (allClubs ?? []).filter((c) =>
          tcRows.some((tc: { club_id: string }) => tc.club_id === c.id)
        )

  // 8. Existing round for this player+tournament
  const { data: existingRound } = await supabase
    .from('rounds')
    .select('id, status')
    .eq('tournament_id', tournament.id)
    .eq('player_id', player.id)
    .single()

  return {
    tournament: {
      id: tournament.id,
      name: tournament.name,
      slug: tournament.slug,
      starts_at: tournament.starts_at,
      status: tournament.status,
    },
    team: { id: team.id, name: team.name, start_hole: team.start_hole },
    members,
    currentPlayerId: player.id,
    startingHole,
    clubs,
    existingRound: existingRound ?? null,
  }
}
