import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { claimRoundAction } from '@/lib/actions/rounds'
import { ActiveHole } from '@/components/round/active-hole'

type Tee = { colour: string; yardage: number; lat?: number; lng?: number }

export default async function HolePage({
  params,
}: {
  params: Promise<{ roundId: string; n: string }>
}) {
  const { roundId, n } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const holeNumber = Number(n)

  const { data: round } = await supabase
    .from('rounds')
    .select('id, player_id, team_id, bag_clubs, tournament_id, tournaments(course_id)')
    .eq('id', roundId)
    .single()
  if (!round) redirect('/')

  // Soft claim (D3) — best-effort; read-only banner handled client-side if claimed_by_other.
  await claimRoundAction(roundId)

  const courseId = (round.tournaments as unknown as { course_id: string } | null)?.course_id
  const { data: hole } = await supabase
    .from('holes')
    .select('id, number, par, pin_lat, pin_lng, tees')
    .eq('course_id', courseId ?? '')
    .eq('number', holeNumber)
    .single()

  const { data: allClubs } = await supabase
    .from('clubs')
    .select('id, display_name')
    .order('display_order')
  const bag = (round.bag_clubs as string[]) ?? []
  const clubs = bag.length ? (allClubs ?? []).filter((c) => bag.includes(c.id)) : (allClubs ?? [])

  // completedCount: how many holes this player has finalized
  const { count: completedCountRaw } = await supabase
    .from('hole_scores')
    .select('*', { count: 'exact', head: true })
    .eq('round_id', roundId)
    .eq('status', 'final')
  const completedCount = completedCountRaw ?? 0

  // teamMembers: all rounds for same team in this tournament (for TurnPicker)
  const { data: teamRoundRows } = await supabase
    .from('rounds')
    .select('player_id, players(id, full_name)')
    .eq('team_id', round.team_id)
    .eq('tournament_id', round.tournament_id)
  const teamMembers = (teamRoundRows ?? []).map((r) => {
    const p = r.players as unknown as { id: string; full_name: string } | null
    return { playerId: r.player_id, name: p?.full_name ?? 'Player' }
  })

  const tees = (hole?.tees ?? []) as Tee[]
  const tee =
    tees[0]?.lat != null
      ? { lat: tees[0].lat!, lng: tees[0].lng! }
      : { lat: hole?.pin_lat ?? 0, lng: hole?.pin_lng ?? 0 }
  const defaultClub = clubs.find((c) => c.display_name === 'Driver') ?? clubs[0] ?? null

  return (
    <ActiveHole
      roundId={round.id}
      holeId={hole?.id ?? `${courseId}-${holeNumber}`}
      holeNumber={holeNumber}
      pin={{ lat: hole?.pin_lat ?? 0, lng: hole?.pin_lng ?? 0 }}
      tee={tee}
      clubs={clubs}
      defaultClubId={defaultClub?.id ?? null}
      playerId={round.player_id}
      completedCount={completedCount}
      teamMembers={teamMembers}
      mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''}
    />
  )
}
