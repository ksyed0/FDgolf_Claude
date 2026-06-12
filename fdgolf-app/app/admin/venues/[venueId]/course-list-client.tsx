'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteCourseAction } from '@/lib/actions/courses'

type Course = {
  id: string
  name: string
  holes_count: number
  par_total: number | null
  course_rating: number | null
  slope_rating: number | null
}

export function CourseListClient({ venueId, courses }: { venueId: string; courses: Course[] }) {
  const router = useRouter()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteCourseAction(id)
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Courses</h2>
        <Link
          href={`/admin/venues/${venueId}/courses/new`}
          className="px-3 py-1.5 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#0e2818' }}
        >
          + Add course
        </Link>
      </div>

      {deleteError && (
        <p
          role="alert"
          className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2"
        >
          {deleteError}
        </p>
      )}

      {courses.length === 0 ? (
        <p className="text-gray-500 text-sm">No courses yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
          {courses.map((c) => (
            <li key={c.id}>
              {confirmingId === c.id ? (
                <div className="flex items-center justify-between px-4 py-3 bg-red-50 border-l-4 border-red-400">
                  <div>
                    <p className="text-sm font-medium text-red-800">
                      Delete &ldquo;{c.name}&rdquo;? This cannot be undone.
                    </p>
                    <p className="text-xs text-red-600">All holes will also be deleted.</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={isPending}
                      className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      {isPending ? 'Deleting…' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setConfirmingId(null)}
                      disabled={isPending}
                      className="text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-sm">{c.name}</p>
                    <p className="text-xs text-gray-500">
                      {c.holes_count} holes
                      {c.par_total != null ? ` · Par ${c.par_total}` : ''}
                      {c.course_rating != null ? ` · ${c.course_rating}` : ''}
                      {c.slope_rating != null ? ` / ${c.slope_rating}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Link
                      href={`/admin/venues/${venueId}/courses/${c.id}`}
                      className="text-green-800 text-sm hover:underline"
                    >
                      Setup holes →
                    </Link>
                    <Link
                      href={`/admin/venues/${venueId}/courses/${c.id}/edit`}
                      className="text-gray-600 text-sm hover:underline"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => {
                        setConfirmingId(c.id)
                        setDeleteError(null)
                      }}
                      disabled={isPending}
                      className="text-red-600 text-sm hover:underline disabled:opacity-50"
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
