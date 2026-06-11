'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteVenueAction } from '@/lib/actions/venues'

type Venue = {
  id: string
  name: string
  city: string | null
  state_province: string | null
  courseCount: number
}

export function VenueListClient({ venues }: { venues: Venue[] }) {
  const router = useRouter()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteVenueAction(id)
      if (result.error) {
        setDeleteError(result.error)
        setConfirmingId(null)
      } else {
        setConfirmingId(null)
        setDeleteError(null)
        router.refresh()
      }
    })
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Venues</h1>
        <Link
          href="/admin/venues/new"
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#0e2818' }}
        >
          + Add venue
        </Link>
      </div>

      {deleteError && (
        <p role="alert" className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {deleteError}
        </p>
      )}

      {venues.length === 0 ? (
        <p className="text-gray-500 text-sm">No venues yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
          {venues.map(v => (
            <li key={v.id}>
              {confirmingId === v.id ? (
                <div className="flex items-center justify-between px-4 py-3 bg-red-50 border-l-4 border-red-400">
                  <div>
                    <p className="text-sm font-medium text-red-800">Delete &ldquo;{v.name}&rdquo;? This cannot be undone.</p>
                    <p className="text-xs text-red-600">All courses and holes will also be deleted.</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleDelete(v.id)}
                      disabled={isPending}
                      className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      {isPending ? 'Deleting…' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setConfirmingId(null)}
                      className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-sm">{v.name}</p>
                    <p className="text-xs text-gray-500">
                      {[v.city, v.state_province].filter(Boolean).join(', ') || 'No address'} &middot; {v.courseCount} course{v.courseCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Link href={`/admin/venues/${v.id}`} className="text-green-800 text-sm hover:underline">View →</Link>
                    <Link href={`/admin/venues/${v.id}/edit`} className="text-gray-600 text-sm hover:underline">Edit</Link>
                    <button
                      onClick={() => { setConfirmingId(v.id); setDeleteError(null) }}
                      className="text-red-600 text-sm hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
