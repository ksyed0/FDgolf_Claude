'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { deleteTournamentAction } from '@/lib/actions/tournaments'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/admin/status-pill'

type TournamentStatus = 'draft' | 'registration_open' | 'active' | 'completed' | 'cancelled'

interface Tournament {
  id: string
  slug: string
  name: string
  status: string
  starts_at: string | null
  venues: { name: string } | null
}

interface TournamentListClientProps {
  tournaments: Tournament[]
}

const FILTER_CHIPS: { label: string; value: TournamentStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Registration Open', value: 'registration_open' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
]

export function TournamentListClient({ tournaments }: TournamentListClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const activeStatus = searchParams.get('status') ?? 'all'

  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleChipClick(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') {
      params.delete('status')
    } else {
      params.set('status', value)
    }
    router.replace(`${pathname}?${params.toString()}`)
  }

  function handleDeleteClick(id: string) {
    setConfirmId(id)
    setError(null)
  }

  function handleCancel() {
    setConfirmId(null)
    setError(null)
  }

  function handleConfirm(id: string) {
    startTransition(async () => {
      const result = await deleteTournamentAction(id)
      if (result.error) {
        setError(result.error)
        setConfirmId(null)
      } else {
        setConfirmId(null)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tournaments</h1>
        <Button asChild>
          <Link href="/admin/tournaments/new">+ New tournament</Link>
        </Button>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            data-active={activeStatus === chip.value ? 'true' : 'false'}
            onClick={() => handleChipClick(chip.value)}
            className={`text-sm px-3 py-1 rounded-full border transition-colors ${
              activeStatus === chip.value
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {tournaments.length === 0 && <p className="text-gray-500 text-sm">No tournaments yet.</p>}

      <ul className="space-y-2">
        {tournaments.map((t) => (
          <li key={t.id}>
            <div className="flex items-center justify-between border rounded px-4 py-3">
              <div>
                <Link href={`/admin/tournaments/${t.slug}`} className="font-medium hover:underline">
                  {t.name}
                </Link>
                <div className="text-sm text-gray-500 space-x-2 mt-1">
                  {t.venues?.name && <span>{t.venues.name}</span>}
                  {t.starts_at && <span>· {new Date(t.starts_at).toLocaleDateString()}</span>}
                  <span className="inline-block ml-1">
                    <StatusPill status={t.status} />
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/tournaments/${t.slug}/edit`}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDeleteClick(t.id)}
                  className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>

            {confirmId === t.id && (
              <div className="mt-1 border border-red-200 bg-red-50 rounded px-4 py-2 flex items-center justify-between">
                {t.status === 'draft' ? (
                  <>
                    <span className="text-sm text-red-800">
                      Delete &ldquo;{t.name}&rdquo;? This cannot be undone.
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={isPending}
                        className="text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleConfirm(t.id)}
                        disabled={isPending}
                        className="text-sm text-red-700 font-medium hover:text-red-900 disabled:opacity-50"
                      >
                        {isPending ? 'Deleting…' : 'Confirm delete'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-red-800">
                      Only draft tournaments can be deleted.
                    </span>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
