import { createClient } from '@/lib/supabase/server'
import { validateInviteToken } from '@/lib/actions/invitations'
import { RegistrationWizard } from './registration-wizard'

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { slug } = await params
  const { token } = await searchParams
  const supabase = await createClient()
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, slug, status')
    .eq('slug', slug)
    .single()

  if (!tournament) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-gray-500">Tournament not found.</p>
      </main>
    )
  }

  if (tournament.status !== 'registration_open') {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <p className="text-gray-500">Registration is not open for this tournament.</p>
      </main>
    )
  }

  let prefill: {
    player: NonNullable<Awaited<ReturnType<typeof validateInviteToken>>['data']>['player']
    token: string
  } | null = null
  if (token) {
    const { data } = await validateInviteToken(token)
    if (!data) {
      return (
        <main className="min-h-screen flex items-center justify-center p-4">
          <p className="text-gray-500">This invite link is no longer valid.</p>
        </main>
      )
    }
    prefill = { player: data.player, token }
  }

  return (
    <RegistrationWizard
      tournament={{ id: tournament.id, name: tournament.name, slug: tournament.slug }}
      prefill={prefill}
    />
  )
}
