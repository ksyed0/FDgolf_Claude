// fdgolf-app/app/admin/scores/[roundId]/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ScoreEditor } from '@/components/admin/score-editor'

export default async function ScoresPage({ params }: { params: { roundId: string } }) {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) redirect('/')

  const { data: shots } = await supabase
    .from('shots')
    .select(
      'id, hole_number, shot_number, outcome, stroke_count, club_id, origin_lat, origin_lng, clubs(display_name)'
    )
    .eq('round_id', params.roundId)
    .order('hole_number', { ascending: true })
    .order('shot_number', { ascending: true })

  const { data: clubs } = await supabase
    .from('clubs')
    .select('id, display_name')
    .order('display_order')

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Round Score Editor</h1>
      <ScoreEditor
        roundId={params.roundId}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        shots={(shots ?? []) as any}
        clubs={clubs ?? []}
      />
    </div>
  )
}
