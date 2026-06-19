'use client'

import { useState } from 'react'
import type { ShotOutcome } from '@/lib/round/types'
import { editShotAction } from '@/lib/actions/shots'
import { strokeCountFor } from '@/lib/round/shot-machine'

type Club = { id: string; display_name: string }

type Props = {
  shotId: string
  initialClubId: string | null
  initialOutcome: ShotOutcome
  clubs: Club[]
  onSave: (patch: { clubId: string | null; outcome: ShotOutcome; strokeCount: 0 | 1 | 2 }) => void
  onCancel: () => void
}

export function EditShotPanel({
  shotId,
  initialClubId,
  initialOutcome,
  clubs,
  onSave,
  onCancel,
}: Props) {
  const [clubId, setClubId] = useState(initialClubId)
  const [outcome, setOutcome] = useState<ShotOutcome>(initialOutcome)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const res = await editShotAction({
      shotId,
      clubId,
      outcome,
      strokeCount: strokeCountFor(outcome),
      originLat: null,
      originLng: null,
    })
    setSaving(false)
    if (res.ok) {
      onSave({ clubId, outcome, strokeCount: strokeCountFor(outcome) })
    } else {
      setError('Save failed. Try again.')
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl bg-slate-800 p-4 shadow-xl">
      <p className="mb-3 text-sm font-semibold text-slate-300">Edit shot</p>

      <label className="mb-3 block text-sm text-slate-400">
        Club
        <select
          className="mt-1 w-full rounded bg-slate-700 p-2 text-white"
          value={clubId ?? ''}
          onChange={(e) => setClubId(e.target.value || null)}
        >
          <option value="">None</option>
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
            </option>
          ))}
        </select>
      </label>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          className={`rounded py-3 font-bold ${outcome === 'in_play' ? 'ring-2 ring-white' : ''} bg-green-700`}
          onClick={() => setOutcome('in_play')}
        >
          In Play
        </button>
        <button
          className={`rounded py-3 font-bold ${outcome === 'sunk' ? 'ring-2 ring-white' : ''} bg-green-500`}
          onClick={() => setOutcome('sunk')}
        >
          Sunk
        </button>
        <button
          className={`rounded py-3 font-bold ${outcome === 'mulligan' ? 'ring-2 ring-white' : ''} bg-amber-500`}
          onClick={() => setOutcome('mulligan')}
        >
          Mulligan
        </button>
        <button
          className={`rounded py-3 font-bold ${outcome === 'out_of_bounds' ? 'ring-2 ring-white' : ''} bg-red-600`}
          onClick={() => setOutcome('out_of_bounds')}
        >
          OOB
        </button>
      </div>

      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          className="flex-1 rounded bg-slate-600 py-3 font-semibold"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          className="flex-1 rounded bg-blue-600 py-3 font-semibold disabled:opacity-50"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
