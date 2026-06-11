'use client'

import { useState, useRef, useEffect } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { saveCourseHolesAction } from '@/lib/actions/course'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { COURSE_PRESETS } from '@/lib/presets/courses'

interface ExistingHole {
  number: number
  par: number
  yardage: number | null
  stroke_index: number | null
  pin_lat?: number | null
}

interface Props {
  tournamentId: string
  courseId: string | null
  tournamentName: string
  venue: string
  holesCount: number
  existingHoles: ExistingHole[]
  tournamentSlug: string
}

interface HoleState {
  par: number
  yardage: string
  strokeIndex: string
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save Course'}
    </Button>
  )
}

/**
 * CourseHolesForm — Client Component for per-hole course setup (US-0011).
 *
 * AC-0050: One editable row per hole (1 to holesCount).
 * AC-0051: Par constrained to 3, 4, or 5 via select.
 * AC-0052: Stroke index inputs 1–18; client-side uniqueness check on submit.
 * AC-0053: Total par computed and displayed at bottom of table.
 * AC-0054: Save persists to holes table via saveCourseHolesAction.
 */
export function CourseHolesForm({
  tournamentId,
  courseId,
  tournamentName,
  venue,
  holesCount,
  existingHoles,
  tournamentSlug,
}: Props) {
  // Build initial state from existingHoles or defaults
  const initialHoles: HoleState[] = Array.from({ length: holesCount }, (_, i) => {
    const n = i + 1
    const existing = existingHoles.find((h) => h.number === n)
    return {
      par: existing?.par ?? 4,
      yardage: existing?.yardage != null ? String(existing.yardage) : '',
      strokeIndex: existing?.stroke_index != null ? String(existing.stroke_index) : '',
    }
  })

  const [holes, setHoles] = useState<HoleState[]>(initialHoles)
  const [clientError, setClientError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false)
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [focusedPresetIndex, setFocusedPresetIndex] = useState<number>(-1)
  const presetDropdownRef = useRef<HTMLDivElement>(null)
  const presetOptionRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        presetDropdownRef.current &&
        !presetDropdownRef.current.contains(event.target as Node)
      ) {
        setPresetDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const [state, formAction] = useFormState(saveCourseHolesAction, { error: null })

  const totalPar = holes.reduce((sum, h) => sum + h.par, 0)

  function handleParChange(index: number, value: string) {
    const par = parseInt(value, 10)
    setHoles((prev) =>
      prev.map((h, i) => (i === index ? { ...h, par } : h))
    )
  }

  function handleYardageChange(index: number, value: string) {
    setHoles((prev) =>
      prev.map((h, i) => (i === index ? { ...h, yardage: value } : h))
    )
  }

  function handleStrokeIndexChange(index: number, value: string) {
    setHoles((prev) =>
      prev.map((h, i) => (i === index ? { ...h, strokeIndex: value } : h))
    )
  }

  function handlePresetImport(presetId: string) {
    const preset = COURSE_PRESETS.find((p) => p.id === presetId)
    /* c8 ignore next */
    if (!preset) return
    setHoles(
      preset.holes.map((h) => ({
        par: h.par,
        yardage: h.tees[0]?.yardage != null ? String(h.tees[0].yardage) : '',
        strokeIndex: String(h.handicap),
      }))
    )
    setSelectedPresetId(presetId)
    setPresetDropdownOpen(false)
    setFocusedPresetIndex(-1)
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Escape') {
      setPresetDropdownOpen(false)
      setFocusedPresetIndex(-1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!presetDropdownOpen) {
        setPresetDropdownOpen(true)
        setFocusedPresetIndex(0)
      } else {
        const next = Math.min(focusedPresetIndex + 1, COURSE_PRESETS.length - 1)
        setFocusedPresetIndex(next)
        presetOptionRefs.current[next]?.focus()
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (presetDropdownOpen) {
        const prev = Math.max(focusedPresetIndex - 1, 0)
        setFocusedPresetIndex(prev)
        presetOptionRefs.current[prev]?.focus()
      }
    }
  }

  function handleOptionKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, presetId: string, index: number) {
    if (e.key === 'Escape') {
      e.preventDefault()
      setPresetDropdownOpen(false)
      setFocusedPresetIndex(-1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.min(index + 1, COURSE_PRESETS.length - 1)
      setFocusedPresetIndex(next)
      presetOptionRefs.current[next]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = Math.max(index - 1, 0)
      setFocusedPresetIndex(prev)
      presetOptionRefs.current[prev]?.focus()
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handlePresetImport(presetId)
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // AC-0052: client-side uniqueness check on stroke indices
    const siValues = holes
      .map((h) => h.strokeIndex.trim())
      .filter((s) => s !== '')
      .map((s) => parseInt(s, 10))

    const siSet = new Set(siValues)
    if (siSet.size !== siValues.length) {
      e.preventDefault()
      setClientError('Stroke indices must be unique across all holes.')
      return
    }

    setClientError(null)
    setSubmitted(true)
  }

  const hasError = clientError ?? state.error
  const showSuccess = submitted && !hasError && state.error === null && state.courseId

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <h1 className="text-2xl font-bold">Course Setup — {tournamentName}</h1>

      {showSuccess && (
        <p role="status" className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-3">
          Course saved!
        </p>
      )}

      {hasError && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-3">
          {hasError}
        </p>
      )}

      <form action={formAction} onSubmit={handleSubmit}>
        {/* Hidden fields */}
        <input type="hidden" name="tournament_id" value={tournamentId} />
        <input type="hidden" name="course_id" value={courseId ?? ''} />
        <input type="hidden" name="name" value={tournamentName} />
        <input type="hidden" name="venue" value={venue} />

        {/* AC-0063: Set Pins link */}
        {courseId && (
          <div className="mb-4">
            <a
              href={`/admin/tournaments/${tournamentSlug}/course/pins`}
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
              data-testid="set-pins-link"
            >
              Set Pins →
            </a>
          </div>
        )}

        {/* AC-0055: Import preset dropdown */}
        <div className="mb-4 flex items-center gap-2" ref={presetDropdownRef}>
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPresetDropdownOpen((open) => !open)
                setFocusedPresetIndex(-1)
              }}
              onKeyDown={handleTriggerKeyDown}
              aria-haspopup="listbox"
              aria-expanded={presetDropdownOpen}
            >
              Import preset
            </Button>
            {presetDropdownOpen && (
              <ul
                role="listbox"
                aria-label="Available course presets"
                className="absolute left-0 z-10 mt-1 min-w-[200px] rounded-md border border-gray-200 bg-white shadow-md"
              >
                {COURSE_PRESETS.map((preset, index) => (
                  <li key={preset.id}>
                    <button
                      ref={(el) => { presetOptionRefs.current[index] = el }}
                      type="button"
                      role="option"
                      aria-selected={selectedPresetId === preset.id}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                      onClick={() => handlePresetImport(preset.id)}
                      onKeyDown={(e) => handleOptionKeyDown(e, preset.id, index)}
                    >
                      {preset.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-12">#</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-28">Par</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-36">Yardage (opt.)</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-36">Stroke Index</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-16">Pins</th>
              </tr>
            </thead>
            <tbody>
              {holes.map((hole, index) => {
                const n = index + 1
                const existingHole = existingHoles.find((h) => h.number === n)
                const hasPin = existingHole?.pin_lat != null
                return (
                  <tr key={n} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-700">{n}</td>
                    <td className="px-3 py-2">
                      <select
                        name={`hole_${n}_par`}
                        value={hole.par}
                        onChange={(e) => handleParChange(index, e.target.value)}
                        className="rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        aria-label={`Hole ${n} par`}
                      >
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                        <option value={5}>5</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        name={`hole_${n}_yardage`}
                        value={hole.yardage}
                        onChange={(e) => handleYardageChange(index, e.target.value)}
                        min={50}
                        max={700}
                        className="w-28"
                        aria-label={`Hole ${n} yardage`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        name={`hole_${n}_stroke_index`}
                        value={hole.strokeIndex}
                        onChange={(e) => handleStrokeIndexChange(index, e.target.value)}
                        min={1}
                        max={18}
                        className="w-28"
                        aria-label={`Hole ${n} stroke index`}
                      />
                    </td>
                    <td className="px-3 py-2 text-center" aria-label={`Hole ${n} pin status`}>
                      {hasPin ? (
                        <span className="text-green-600 font-semibold" title="Pin set">✓</span>
                      ) : (
                        <span className="text-gray-400" title="No pin">–</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                <td className="px-3 py-2 text-gray-700" colSpan={1}>Total</td>
                <td className="px-3 py-2 text-gray-900" data-testid="total-par">
                  Par: {totalPar}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-6">
          <SubmitButton />
        </div>
      </form>
    </div>
  )
}
