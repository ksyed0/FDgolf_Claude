// fdgolf-app/components/admin/score-editor.tsx
'use client'

import { useState } from 'react'
import { editShotAction, getShotEditsAction } from '@/lib/actions/shots'
import { ShotAuditTrail } from './shot-audit-trail'

export type Shot = {
  id: string
  hole_number: number
  shot_number: number
  outcome: string
  stroke_count: number
  club_id: string | null
  origin_lat: number | null
  origin_lng: number | null
  clubs: { display_name: string } | null
}

type Club = { id: string; display_name: string }

type Edit = {
  id: string
  edited_by: string
  before_state: Record<string, unknown>
  after_state: Record<string, unknown>
  created_at: string
}

type Props = {
  roundId: string
  shots: Shot[]
  clubs: Club[]
}

const OUTCOMES = ['in_play', 'sunk', 'mulligan', 'out_of_bounds'] as const

export function ScoreEditor({ shots, clubs }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [localShots, setLocalShots] = useState(shots)
  const [editAudits, setEditAudits] = useState<Edit[]>([])

  const byHole: Record<number, Shot[]> = {}
  for (const s of localShots) {
    ;(byHole[s.hole_number] ??= []).push(s)
  }

  async function openEdit(shotId: string) {
    setEditingId(shotId)
    const edits = await getShotEditsAction(shotId)
    setEditAudits(edits as Edit[])
  }

  async function handleSave(shot: Shot, formData: FormData) {
    setSaving(true)
    const outcome = formData.get('outcome') as (typeof OUTCOMES)[number]
    const clubId = formData.get('clubId') as string | null
    const strokeCount: 0 | 1 | 2 = outcome === 'mulligan' ? 0 : outcome === 'out_of_bounds' ? 2 : 1

    const result = await editShotAction({
      shotId: shot.id,
      clubId: clubId || null,
      outcome,
      strokeCount,
      originLat: shot.origin_lat,
      originLng: shot.origin_lng,
    })

    if (result.ok) {
      setLocalShots((prev) =>
        prev.map((s) =>
          s.id === shot.id ? { ...s, outcome, club_id: clubId, stroke_count: strokeCount } : s
        )
      )
      setEditingId(null)
    }
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-6">
      {Object.entries(byHole).map(([holeNum, holeShots]) => (
        <div key={holeNum} className="bg-slate-800 rounded p-4">
          <h3 className="font-bold mb-2">Hole {holeNum}</h3>
          {holeShots.map((shot) => (
            <div key={shot.id} data-testid="shot-row" className="border-b border-slate-700 py-2">
              {editingId === shot.id ? (
                <form
                  action={async (fd) => {
                    await handleSave(shot, fd)
                  }}
                  className="flex flex-col gap-2"
                >
                  <label className="text-xs text-slate-400">Outcome</label>
                  <select
                    name="outcome"
                    aria-label="outcome"
                    defaultValue={shot.outcome}
                    className="bg-slate-700 rounded px-2 py-1 text-sm"
                  >
                    {OUTCOMES.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  <label className="text-xs text-slate-400">Club</label>
                  <select
                    name="clubId"
                    aria-label="club"
                    defaultValue={shot.club_id ?? ''}
                    className="bg-slate-700 rounded px-2 py-1 text-sm"
                  >
                    <option value="">— none —</option>
                    {clubs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.display_name}
                      </option>
                    ))}
                  </select>
                  <ShotAuditTrail edits={editAudits} isAdmin={true} />
                  <div className="flex gap-2 mt-1">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded bg-green-700 px-3 py-1 text-sm font-bold"
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded bg-slate-700 px-3 py-1 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm">
                    Shot {shot.shot_number} · {shot.clubs?.display_name ?? '—'} · {shot.outcome} ·{' '}
                    {shot.stroke_count} strokes
                  </span>
                  <button
                    onClick={() => openEdit(shot.id)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
