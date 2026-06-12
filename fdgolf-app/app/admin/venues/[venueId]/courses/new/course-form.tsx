'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { createCourseAction, updateCourseAction } from '@/lib/actions/courses'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type TeeYardage = { colour: string; total_yardage: string }

type ExistingCourse = {
  id: string
  name: string
  holes_count: number
  par_total: number | null
  course_rating: number | null
  slope_rating: number | null
  tee_yardages: { colour: string; total_yardage: number }[]
}

interface CourseFormProps {
  venueId: string
  course?: ExistingCourse
}

const initialState = { error: null as string | null }

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Saving…' : label}
    </Button>
  )
}

export function CourseForm({ venueId, course }: CourseFormProps) {
  const isEdit = Boolean(course)
  const action = isEdit
    ? updateCourseAction.bind(null, course!.id)
    : createCourseAction.bind(null, venueId)

  const [state, formAction] = useFormState(action, initialState)

  const [teeRows, setTeeRows] = useState<TeeYardage[]>(() =>
    (course?.tee_yardages ?? []).map((t) => ({
      colour: t.colour,
      total_yardage: String(t.total_yardage),
    }))
  )

  function addTeeRow() {
    if (teeRows.length >= 3) return
    setTeeRows((prev) => [...prev, { colour: '', total_yardage: '' }])
  }

  function removeTeeRow(index: number) {
    setTeeRows((prev) => prev.filter((_, i) => i !== index))
  }

  function updateTeeRow(index: number, field: keyof TeeYardage, value: string) {
    setTeeRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  const teeYardagesJson = JSON.stringify(
    teeRows
      .filter((r) => r.colour.trim())
      .map((r) => ({
        colour: r.colour.trim(),
        total_yardage: parseInt(r.total_yardage, 10) || 0,
      }))
  )

  return (
    <form action={formAction} aria-label="course form" role="form" className="space-y-4 max-w-lg">
      <input type="hidden" name="tee_yardages" value={teeYardagesJson} />

      <div className="space-y-1">
        <Label htmlFor="name">Course name *</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={course?.name ?? ''}
          placeholder="e.g. Main Course"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="holes_count">Number of holes</Label>
        <select
          id="holes_count"
          name="holes_count"
          defaultValue={String(course?.holes_count ?? 18)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="18">18</option>
          <option value="9">9</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor="par_total">Par total</Label>
          <Input
            id="par_total"
            name="par_total"
            type="number"
            defaultValue={course?.par_total != null ? String(course.par_total) : ''}
            placeholder="72"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="course_rating">Course rating</Label>
          <Input
            id="course_rating"
            name="course_rating"
            type="number"
            step="0.1"
            defaultValue={course?.course_rating != null ? String(course.course_rating) : ''}
            placeholder="71.5"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="slope_rating">Slope rating</Label>
          <Input
            id="slope_rating"
            name="slope_rating"
            type="number"
            defaultValue={course?.slope_rating != null ? String(course.slope_rating) : ''}
            placeholder="128"
          />
        </div>
      </div>

      {/* Tee yardages */}
      <div className="space-y-2">
        <Label>Tee yardages</Label>
        {teeRows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              placeholder="Colour"
              value={row.colour}
              onChange={(e) => updateTeeRow(i, 'colour', e.target.value)}
              className="w-28"
            />
            <Input
              placeholder="Total yds"
              type="number"
              value={row.total_yardage}
              onChange={(e) => updateTeeRow(i, 'total_yardage', e.target.value)}
              className="w-28"
            />
            <button
              type="button"
              onClick={() => removeTeeRow(i)}
              className="text-red-500 text-sm hover:text-red-700"
              aria-label={`Remove tee row ${i + 1}`}
            >
              ×
            </button>
          </div>
        ))}
        {teeRows.length < 3 && (
          <button
            type="button"
            onClick={addTeeRow}
            className="text-sm text-green-800 hover:underline"
          >
            + Add tee
          </button>
        )}
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <SubmitButton label={isEdit ? 'Save changes' : 'Create course'} />
    </form>
  )
}
