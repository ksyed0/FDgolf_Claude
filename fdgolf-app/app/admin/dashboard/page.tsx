// fdgolf-app/app/admin/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'
import { KpiCards } from '@/components/admin/kpi-cards'
import { LiveRoundsTable, type RoundRow } from '@/components/admin/live-rounds-table'

export const revalidate = 30 // AC-0236

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { count: playersCount },
    { count: teamsPlaying },
    { count: syncIssues },
    { data: liveRoundsRaw },
  ] = await Promise.all([
    supabase.from('players').select('*', { count: 'exact', head: true }),
    supabase.from('rounds').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
    supabase
      .from('rounds')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'in_progress')
      .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()),
    supabase
      .from('rounds')
      .select('id, team_id, started_at, player_id, players(full_name), hole_scores(status)')
      .eq('status', 'in_progress')
      .order('started_at', { ascending: true }),
  ])

  const rounds: RoundRow[] = (liveRoundsRaw ?? []).map((r) => {
    const holesPlayed = ((r.hole_scores as unknown as { status: string }[]) ?? []).filter(
      (h) => h.status === 'final'
    ).length
    const elapsedMin = r.started_at ? (Date.now() - new Date(r.started_at).getTime()) / 60000 : null
    const pace = holesPlayed > 0 && elapsedMin ? elapsedMin / holesPlayed : null
    return {
      roundId: r.id,
      teamName: `Team ${(r.team_id as string)?.slice(0, 6) ?? '—'}`,
      playerNames: [(r.players as unknown as { full_name: string } | null)?.full_name ?? 'Player'],
      thru: holesPlayed,
      score: null,
      paceMinutesPerHole: pace ? Math.round(pace) : null,
    }
  })

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <KpiCards
        playersCount={playersCount ?? 0}
        teamsPlaying={teamsPlaying ?? 0}
        avgPaceMinutes={0}
        syncIssues={syncIssues ?? 0}
      />
      <LiveRoundsTable rounds={rounds} />
    </div>
  )
}
