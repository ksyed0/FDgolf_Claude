import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProfileForm } from './profile-form'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: player } = await supabase.from('players').select().eq('user_id', user.id).single()

  if (!player) {
    return (
      <main className="p-8">
        <p className="text-gray-500">No player profile found.</p>
      </main>
    )
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Your Profile</h1>
      <ProfileForm player={player} />
    </main>
  )
}
