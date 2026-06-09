interface TournamentDetailPageProps {
  params: { slug: string }
}

/**
 * /admin/tournaments/[slug] — Tournament detail page stub (US-0009).
 *
 * Placeholder that confirms the redirect after tournament creation lands
 * somewhere. A full detail view will be implemented in a later story.
 */
export default function TournamentDetailPage({ params }: TournamentDetailPageProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Tournament Created</h1>
      <p className="mt-2 text-gray-500">Slug: {params.slug}</p>
    </main>
  )
}
