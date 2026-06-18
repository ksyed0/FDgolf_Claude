import { createClient } from '@/lib/supabase/server'
import { KpiCards } from '@/components/admin/kpi-cards'

export const revalidate = 30 // AC-0236: refresh every 30s via Next.js ISR

export default async function DashboardPage() {
  const supabase = await createClient()

  const [{ count: playersCount }, { count: teamsPlaying }, { count: syncIssues }] =
    await Promise.all([
      supabase.from('players').select('*', { count: 'exact', head: true }),
      supabase
        .from('rounds')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'in_progress'),
      supabase
        .from('rounds')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'in_progress')
        .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()),
    ])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <KpiCards
        playersCount={playersCount ?? 0}
        teamsPlaying={teamsPlaying ?? 0}
        avgPaceMinutes={0}
        syncIssues={syncIssues ?? 0}
      />
    </div>
  )
}
