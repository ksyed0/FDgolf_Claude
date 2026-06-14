import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HoleEntryScreen } from '@/components/round/hole-entry-screen'

type Tee = { colour: string; yardage: number }

export default async function RoundPage({ params }: { params: { roundId: string } }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch round with tournament join for course_id
  const { data: round } = await supabase
    .from('rounds')
    .select('id, start_hole, status, bag_clubs, tournament_id, player_id, tournaments(course_id)')
    .eq('id', params.roundId)
    .single()

  if (!round) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <p className="text-slate-400">Round not found.</p>
      </main>
    )
  }

  const courseId = (round.tournaments as unknown as { course_id: string } | null)?.course_id

  // Fetch starting hole
  const { data: hole } = await supabase
    .from('holes')
    .select('number, par, handicap, pin_lat, pin_lng, tees')
    .eq('course_id', courseId ?? '')
    .eq('number', round.start_hole)
    .single()

  // Fetch bag clubs (filtered to round.bag_clubs if non-empty)
  const bagClubIds = (round.bag_clubs as string[]) ?? []
  // Fetch ALL clubs (not single)
  const { data: allClubs } = await supabase
    .from('clubs')
    .select('id, display_name')
    .order('display_order')

  const clubs =
    bagClubIds.length > 0
      ? (allClubs ?? []).filter((c) => bagClubIds.includes(c.id))
      : (allClubs ?? [])

  const tees = (hole?.tees ?? []) as Tee[]
  const holeData = {
    number: hole?.number ?? round.start_hole,
    par: hole?.par ?? 4,
    strokeIndex: hole?.handicap ?? null,
    yardage: tees[0]?.yardage ?? null,
    pinLat: hole?.pin_lat ?? null,
    pinLng: hole?.pin_lng ?? null,
  }

  return <HoleEntryScreen roundId={round.id} hole={holeData} clubs={clubs} shotNumber={1} />
}
