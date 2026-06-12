import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')

  if (isAdmin) {
    redirect('/admin/tournaments')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">FDgolf</h1>
      <p className="mt-2 text-gray-500">Coming soon</p>
    </main>
  )
}
