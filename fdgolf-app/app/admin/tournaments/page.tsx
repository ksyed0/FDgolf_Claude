import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function TournamentsPage() {
  const supabase = createClient()

  const { data: isAdmin, error: adminError } = await supabase.rpc('fdgolf_is_admin')
  if (adminError || !isAdmin) redirect('/')

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('slug, name, date, status')
    .order('date', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tournaments</h1>
        <Link
          href="/admin/tournaments/new"
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#0e2818' }}
        >
          New tournament
        </Link>
      </div>

      {!tournaments?.length ? (
        <p className="text-gray-500 text-sm">No tournaments yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
          {tournaments.map((t) => (
            <li key={t.slug}>
              <Link
                href={`/admin/tournaments/${t.slug}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.date ?? 'No date'}</p>
                </div>
                <span className="text-xs text-gray-400 capitalize">{t.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
