import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { completeRoundAction } from '@/lib/actions/rounds'

export default async function RoundCompletePage({
  params,
}: {
  params: Promise<{ roundId: string }>
}) {
  const { roundId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await completeRoundAction(roundId) // AC-0176: idempotent; only completes when 18 finals

  const { data: finals } = await supabase
    .from('hole_scores')
    .select('gross_score')
    .eq('round_id', roundId)
    .eq('status', 'final')

  const total = (finals ?? []).reduce((sum, h) => sum + Number(h.gross_score), 0)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-900 p-6 text-white">
      <h1 className="text-2xl font-bold">Round complete</h1>
      <p className="text-lg text-green-400">Total gross: {total}</p>
    </main>
  )
}
