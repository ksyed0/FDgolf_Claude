import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { validateInviteToken } from '@/lib/actions/invitations'
import { AccountForm } from './account-form'

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { slug } = await params
  const { token } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect(`/register/${slug}/team`)

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name')
    .eq('slug', slug)
    .single()
  if (!tournament) redirect(`/register/${slug}`)

  let prefill: { email: string; fullName: string; token: string } | null = null
  if (token) {
    const { data } = await validateInviteToken(token)
    if (!data) redirect(`/register/${slug}`)
    prefill = { email: data.player.email, fullName: data.player.full_name, token }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{tournament.name}</h1>
          <p className="text-sm text-gray-500">Create your account</p>
        </div>
        <AccountForm tournamentId={tournament.id} slug={slug} prefill={prefill} />
      </div>
    </main>
  )
}
