'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { saveCourseHolesAction } from '@/lib/actions/course'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ExistingHole {
  number: number
  par: number
  yardage: number | null
  stroke_index: number | null
}

interface Props {
  tournamentId: string
  courseId: string | null
  tournamentName: string
  venue: string
  holesCount: number
  existingHoles: ExistingHole[]
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

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-12">#</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-28">Par</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-36">Yardage (opt.)</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-36">Stroke Index</th>
              </tr>
            </thead>
            <tbody>
              {holes.map((hole, index) => {
                const n = index + 1
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
                <td colSpan={2} />
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
