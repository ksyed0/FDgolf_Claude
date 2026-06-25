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

  const { data: registrations } = await supabase
    .from('tournament_registrations')
    .select('status, registered_at, tournaments(id, name, date, status)')
    .eq('player_id', player.id)
    .order('registered_at', { ascending: false })

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Your Profile</h1>
      <ProfileForm player={player} />

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Tournament History</h2>
        {registrations && registrations.length > 0 ? (
          <ul className="space-y-2">
            {registrations.map((reg) => {
              const t = reg.tournaments as unknown as {
                id: string
                name: string
                date: string
                status: string
              } | null
              if (!t) return null
              return (
                <li
                  key={t.id}
                  className="border rounded-md px-4 py-3 flex justify-between items-center"
                >
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-sm text-gray-500">{t.date}</p>
                  </div>
                  <span className="text-xs bg-gray-100 rounded px-2 py-1 capitalize">
                    {reg.status}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-gray-500 text-sm">No tournaments yet.</p>
        )}
      </section>
    </main>
  )
}
