'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { saveClubsAction } from '@/lib/actions/clubs'
import { Button } from '@/components/ui/button'

export interface Club {
  id: string
  display_name: string
  club_type: string
  display_order: number
}

interface Props {
  tournamentId: string
  tournamentName: string
  allClubs: Club[]
  /** IDs of clubs currently active for this tournament. Empty = all active (no-rows invariant). */
  activeClubIds: string[]
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save Club Selection'}
    </Button>
  )
}

/**
 * ClubPickerForm — Client Component for tournament club picker (US-0015).
 *
 * AC-0067: All master clubs listed with toggle controls; defaults to all-active.
 *
 * "no rows = all clubs active" invariant:
 *   When activeClubIds is empty on load, all clubs are displayed as active.
 *   On save, if all clubs are toggled on, all IDs are submitted, producing
 *   rows in tournament_clubs. If some are toggled off, only the active IDs
 *   are submitted.
 */
export function ClubPickerForm({
  tournamentId,
  tournamentName,
  allClubs,
  activeClubIds,
}: Props) {
  // "no rows = all clubs active" — if activeClubIds is empty, default to all clubs on
  const initialActive = new Set<string>(
    activeClubIds.length === 0 ? allClubs.map((c) => c.id) : activeClubIds
  )

  const [activeSet, setActiveSet] = useState<Set<string>>(initialActive)

  const [state, formAction] = useFormState(saveClubsAction, { error: null, success: false })

  function toggleClub(clubId: string) {
    setActiveSet((prev) => {
      const next = new Set(prev)
      if (next.has(clubId)) {
        next.delete(clubId)
      } else {
        next.add(clubId)
      }
      return next
    })
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <h1 className="text-2xl font-bold">Available Clubs — {tournamentName}</h1>

      <p className="text-sm text-gray-600">
        Toggle clubs to enable or disable them for this tournament.
        Disabled clubs will not appear in the player&apos;s bag picker.
      </p>

      {state.success === true && (
        <p role="status" className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-3">
          Club selection saved!
        </p>
      )}

      {state.error !== null && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-3">
          {state.error}
        </p>
      )}

      <form action={formAction}>
        <input type="hidden" name="tournament_id" value={tournamentId} />

        {/* Hidden inputs for each active club ID — inside form so FormData captures them */}
        {allClubs
          .filter((club) => activeSet.has(club.id))
          .map((club) => (
            <input
              key={`hidden-${club.id}`}
              type="hidden"
              name="active_club_id"
              value={club.id}
            />
          ))}

        <div className="space-y-2">
          {allClubs.map((club) => {
            const isActive = activeSet.has(club.id)
            return (
              <div
                key={club.id}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                  isActive
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 bg-gray-50 opacity-60'
                }`}
              >
                <div>
                  <span className="font-medium text-sm text-gray-900">
                    {club.display_name}
                  </span>
                  <span className="ml-2 text-xs text-gray-500 capitalize">
                    {club.club_type}
                  </span>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  aria-label={`Toggle ${club.display_name}`}
                  onClick={() => toggleClub(club.id)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                    isActive ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            )
          })}
        </div>

        {allClubs.length === 0 && (
          <p className="text-sm text-gray-500 py-4 text-center">
            No clubs found. Ensure the master club list has been seeded.
          </p>
        )}

        <div className="mt-6 flex items-center gap-4">
          <SubmitButton />
          <span className="text-sm text-gray-500">
            {activeSet.size} of {allClubs.length} clubs active
          </span>
        </div>
      </form>
    </div>
  )
}
