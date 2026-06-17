import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HoleSummary } from '@/components/round/hole-summary'
import { HoleSummaryClient } from '@/components/round/hole-summary-client'

export default async function HoleSummaryPage({
  params,
}: {
  params: { roundId: string; n: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const holeNumber = Number(params.n)

  const { data: round } = await supabase
    .from('rounds')
    .select('id, team_id, tournament_id, tournaments(course_id)')
    .eq('id', params.roundId)
    .single()
  if (!round) redirect('/')

  const courseId = (round.tournaments as unknown as { course_id: string } | null)?.course_id
  const { data: hole } = await supabase
    .from('holes')
    .select('par')
    .eq('course_id', courseId ?? '')
    .eq('number', holeNumber)
    .single()

  // Per-player gross for this hole's team (server-derived hole_scores).
  const { data: scores } = await supabase
    .from('hole_scores')
    .select('round_id, gross_score, rounds(player_id, players(full_name))')
    .eq('hole_number', holeNumber)

  // Best Ball contributor for this hole (server-derived).
  const { data: best } = await supabase
    .from('team_hole_scores')
    .select('contributing_player_id')
    .eq('team_id', round.team_id)
    .eq('hole_number', holeNumber)
    .single()

  const players = (scores ?? []).map((s) => {
    const r = s.rounds as unknown as {
      player_id: string
      players: { full_name: string } | null
    } | null
    return {
      playerId: r?.player_id ?? '',
      name: r?.players?.full_name ?? 'Player',
      gross: s.gross_score,
    }
  })

  return (
    <HoleSummaryClient roundId={round.id} holeNumber={holeNumber}>
      <HoleSummary
        holeNumber={holeNumber}
        par={hole?.par ?? 4}
        players={players}
        bestPlayerId={best?.contributing_player_id ?? null}
        teamStanding={null}
        stale={false}
        onNext={() => {}}
      />
    </HoleSummaryClient>
  )
}
