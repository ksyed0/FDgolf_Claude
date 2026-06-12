'use client'

import React, { useState, useTransition } from 'react'
import { saveHolesAction } from '@/lib/actions/holes'
import { COURSE_PRESETS } from '@/lib/presets/courses'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type TeeInput = { colour: string; yardage: string }
type HoleRow = {
  number: number
  par: number
  handicap: string
  tees: [TeeInput, TeeInput, TeeInput]
  pin_lat: number | null
}

interface DbHole {
  id?: string
  number: number
  par: number
  handicap: number | null
  pin_lat: number | null
  pin_lng?: number | null
  tees: Array<{ colour: string; yardage: number; lat?: number | null; lng?: number | null }>
}

function dbHoleToRow(hole: DbHole, holeNumber: number): HoleRow {
  const tees = hole.tees ?? []
  return {
    number: holeNumber,
    par: hole.par ?? 4,
    handicap: hole.handicap != null ? String(hole.handicap) : '',
    tees: [
      {
        colour: tees[0]?.colour ?? '',
        yardage: tees[0]?.yardage != null ? String(tees[0].yardage) : '',
      },
      {
        colour: tees[1]?.colour ?? '',
        yardage: tees[1]?.yardage != null ? String(tees[1].yardage) : '',
      },
      {
        colour: tees[2]?.colour ?? '',
        yardage: tees[2]?.yardage != null ? String(tees[2].yardage) : '',
      },
    ],
    pin_lat: hole.pin_lat ?? null,
  }
}

function buildDefaultRows(count: number): HoleRow[] {
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    par: 4,
    handicap: '',
    tees: [
      { colour: '', yardage: '' },
      { colour: '', yardage: '' },
      { colour: '', yardage: '' },
    ],
    pin_lat: null,
  }))
}

interface HoleEditorProps {
  courseId: string
  holesCount: number
  initialHoles: DbHole[]
}

export function HoleEditor({ courseId, holesCount, initialHoles }: HoleEditorProps) {
  const [rows, setRows] = useState<HoleRow[]>(() => {
    if (initialHoles.length > 0) {
      return initialHoles.map((h) => dbHoleToRow(h, h.number))
    }
    return buildDefaultRows(holesCount)
  })
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [showPresets, setShowPresets] = useState(false)

  function updateRow(
    index: number,
    field: keyof Omit<HoleRow, 'tees' | 'number' | 'pin_lat'>,
    value: string | number
  ) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  function updateTee(rowIndex: number, teeIndex: number, field: keyof TeeInput, value: string) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== rowIndex) return r
        const newTees = r.tees.map((t, ti) => (ti === teeIndex ? { ...t, [field]: value } : t)) as [
          TeeInput,
          TeeInput,
          TeeInput,
        ]
        return { ...r, tees: newTees }
      })
    )
  }

  function applyPreset(presetId: string) {
    const preset = COURSE_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    setRows((prev) =>
      prev.map((row) => {
        const ph = preset.holes.find((h) => h.number === row.number)
        if (!ph) return row
        return {
          ...row,
          par: ph.par,
          handicap: String(ph.handicap),
          tees: [
            {
              colour: ph.tees[0]?.colour ?? '',
              yardage: ph.tees[0]?.yardage != null ? String(ph.tees[0].yardage) : '',
            },
            { colour: '', yardage: '' },
            { colour: '', yardage: '' },
          ],
        }
      })
    )
    setShowPresets(false)
  }

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const holes = rows.map((r) => ({
        number: r.number,
        par: Number(r.par),
        handicap: r.handicap !== '' ? Number(r.handicap) : null,
        tees: r.tees
          .filter((t) => t.colour.trim() !== '')
          .map((t) => ({
            colour: t.colour.trim(),
            yardage: Number(t.yardage) || 0,
            lat: null,
            lng: null,
          })),
      }))
      const result = await saveHolesAction(courseId, holes)
      if (result.error) {
        setError(result.error)
      } else {
        setSaved(true)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Holes</h2>
        <div className="relative">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPresets((v) => !v)}
          >
            Import preset ▾
          </Button>
          {showPresets && (
            <div className="absolute right-0 mt-1 bg-white border rounded shadow-md z-10 min-w-40">
              {COURSE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={() => applyPreset(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-2 py-2 w-8">#</th>
              <th className="px-2 py-2 w-16">Par</th>
              <th className="px-2 py-2 w-16">Hcp</th>
              <th className="px-2 py-2">Tee 1 colour</th>
              <th className="px-2 py-2 w-20">Yds</th>
              <th className="px-2 py-2">Tee 2 colour</th>
              <th className="px-2 py-2 w-20">Yds</th>
              <th className="px-2 py-2">Tee 3 colour</th>
              <th className="px-2 py-2 w-20">Yds</th>
              <th className="px-2 py-2 w-10">Pin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.number} className="border-t">
                <td className="px-2 py-1 text-gray-500">{row.number}</td>
                <td className="px-2 py-1">
                  <Input
                    type="number"
                    min={3}
                    max={5}
                    value={row.par}
                    onChange={(e) => updateRow(i, 'par', e.target.value)}
                    className="w-14 h-8 text-sm"
                  />
                </td>
                <td className="px-2 py-1">
                  <Input
                    type="number"
                    min={1}
                    max={18}
                    value={row.handicap}
                    onChange={(e) => updateRow(i, 'handicap', e.target.value)}
                    placeholder="–"
                    className="w-14 h-8 text-sm"
                  />
                </td>
                {([0, 1, 2] as const).map((ti) => (
                  <React.Fragment key={ti}>
                    <td className="px-2 py-1">
                      <Input
                        value={row.tees[ti].colour}
                        onChange={(e) => updateTee(i, ti, 'colour', e.target.value)}
                        placeholder="e.g. Blue"
                        className="w-24 h-8 text-sm"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        type="number"
                        value={row.tees[ti].yardage}
                        onChange={(e) => updateTee(i, ti, 'yardage', e.target.value)}
                        placeholder="0"
                        className="w-16 h-8 text-sm"
                        disabled={!row.tees[ti].colour}
                      />
                    </td>
                  </React.Fragment>
                ))}
                <td className="px-2 py-1 text-center">
                  {row.pin_lat != null ? (
                    <span className="text-green-600 text-base">✓</span>
                  ) : (
                    <span className="text-gray-400 text-base">–</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {saved && <p className="text-sm text-green-700">Holes saved.</p>}
      <Button onClick={handleSave} disabled={isPending} className="w-full sm:w-auto">
        {isPending ? 'Saving…' : 'Save all holes'}
      </Button>
    </div>
  )
}
