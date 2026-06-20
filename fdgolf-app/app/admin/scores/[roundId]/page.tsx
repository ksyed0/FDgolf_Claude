import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireTournamentAccess } from '@/lib/supabase/auth-guards'
import { ScoreEditor, type Shot } from '@/components/admin/score-editor'

export default async function ScoresPage({ params }: { params: { roundId: string } }) {
  const supabase = await createClient()

  // Resolve tournament via round so we can check organizer scope
  const { data: round } = await supabase
    .from('rounds')
    .select('tournament_id')
    .eq('id', params.roundId)
    .single()
  if (!round) notFound()

  await requireTournamentAccess(round.tournament_id)

  const { data: shots } = (await supabase
    .from('shots')
    .select(
      'id, hole_number, shot_number, outcome, stroke_count, club_id, origin_lat, origin_lng, clubs(display_name)'
    )
    .eq('round_id', params.roundId)
    .order('hole_number', { ascending: true })
    .order('shot_number', { ascending: true })) as { data: Shot[] | null }

  const { data: clubs } = await supabase
    .from('clubs')
    .select('id, display_name')
    .order('display_order')

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Round Score Editor</h1>
      <ScoreEditor roundId={params.roundId} shots={shots ?? []} clubs={clubs ?? []} />
    </div>
  )
}
