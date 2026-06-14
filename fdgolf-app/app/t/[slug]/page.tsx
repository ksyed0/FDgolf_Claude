import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPlayerContext } from '@/lib/supabase/player'
import { PreRoundWizard } from '@/components/pre-round/pre-round-wizard'

export default async function TournamentPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const context = await getPlayerContext(params.slug, user.id)

  if (!context) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <p className="text-slate-400">Tournament not found.</p>
      </main>
    )
  }

  if (context.existingRound) {
    redirect(`/round/${context.existingRound.id}`)
  }

  return <PreRoundWizard context={context} />
}
