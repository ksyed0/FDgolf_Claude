'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import {
  createTournamentAction,
  updateTournamentAction,
  checkSlugAvailableAction,
} from '@/lib/actions/tournaments'
import { getCoursesForVenueAction } from '@/lib/actions/courses'
import { generateSlug } from '@/lib/utils/slug'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState = { error: null as string | null }

function SubmitButton({ editMode }: { editMode: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending
        ? editMode
          ? 'Saving…'
          : 'Creating…'
        : editMode
          ? 'Save changes'
          : 'Create tournament'}
    </Button>
  )
}

interface TournamentFormProps {
  venues: { id: string; name: string }[]
  tournament?: {
    id: string
    name: string
    slug: string
    venue_id: string | null
    course_id: string | null
    starts_at: string | null
    format: string
    start_style: string
    holes_count: number
  }
}

/**
 * TournamentForm — Client Component for tournament creation and editing.
 *
 * Create mode (tournament undefined): uses createTournamentAction; shows editable slug.
 * Edit mode (tournament provided):    uses updateTournamentAction; hides slug field.
 *
 * Venue → Course cascade: selecting a venue fetches courses via getCoursesForVenueAction.
 */
export function TournamentForm({ venues, tournament }: TournamentFormProps) {
  const editMode = tournament !== undefined
  const boundAction = editMode
    ? updateTournamentAction.bind(null, tournament!.id)
    : createTournamentAction

  const [state, formAction] = useFormState(boundAction, initialState)

  // Slug state (create mode only)
  const [slugValue, setSlugValue] = useState('')
  const [slugError, setSlugError] = useState('')
  const [slugChecking, setSlugChecking] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Venue / Course cascade
  const [selectedVenueId, setSelectedVenueId] = useState(tournament?.venue_id ?? '')
  const [courseOptions, setCourseOptions] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    void (async () => {
      const courses = selectedVenueId ? await getCoursesForVenueAction(selectedVenueId) : []
      setCourseOptions(courses)
    })()
  }, [selectedVenueId])

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (editMode) return
    const value = e.target.value
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSlugValue(generateSlug(value))
      setSlugError('')
    }, 300)
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setSlugValue(value)
    if (value && !/^[a-z0-9-]*$/.test(value)) {
      setSlugError('Only lowercase letters, digits, and hyphens')
    } else {
      setSlugError('')
    }
  }

  async function handleSlugBlur() {
    if (!slugValue) return
    if (!/^[a-z0-9-]+$/.test(slugValue)) return
    setSlugChecking(true)
    try {
      const { available } = await checkSlugAvailableAction(slugValue)
      if (!available) {
        setSlugError('This URL is already taken')
      }
    } finally {
      setSlugChecking(false)
    }
  }

  // Derive datetime-local value from ISO string for pre-population
  const startsAtLocal = tournament?.starts_at
    ? tournament.starts_at.slice(0, 16) // "YYYY-MM-DDTHH:mm"
    : undefined

  return (
    <form action={formAction} className="space-y-5">
      {/* Name */}
      <div className="space-y-1">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          placeholder="e.g. Summer Classic 2026"
          defaultValue={tournament?.name ?? ''}
          onChange={handleNameChange}
        />
      </div>

      {/* URL Slug — create mode only */}
      {!editMode ? (
        <div className="space-y-1">
          <Label htmlFor="slug_override">URL Slug</Label>
          <Input
            id="slug_override"
            name="slug_override"
            type="text"
            value={slugValue}
            onChange={handleSlugChange}
            onBlur={handleSlugBlur}
            placeholder="e.g. summer-classic-2026"
            aria-describedby={slugError ? 'slug-error' : 'slug-hint'}
            readOnly={slugChecking}
          />
          {slugError ? (
            <p id="slug-error" role="alert" className="text-sm text-red-600">
              {slugError}
            </p>
          ) : (
            <p id="slug-hint" className="text-xs text-muted-foreground">
              e.g. summer-classic-2026
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          URL slug cannot be changed after creation: <strong>{tournament!.slug}</strong>
        </p>
      )}

      {/* Venue */}
      <div className="space-y-1">
        <Label htmlFor="venue_id">Venue</Label>
        <select
          id="venue_id"
          name="venue_id"
          value={selectedVenueId}
          onChange={(e) => setSelectedVenueId(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Select a venue</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>

      {/* Course */}
      <div className="space-y-1">
        <Label htmlFor="course_id">Course</Label>
        <select
          id="course_id"
          name="course_id"
          defaultValue={tournament?.course_id ?? ''}
          disabled={!selectedVenueId}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Select a course (optional)</option>
          {courseOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Start Date & Time */}
      <div className="space-y-1">
        <Label htmlFor="starts_at">Start Date &amp; Time</Label>
        <Input
          id="starts_at"
          name="starts_at"
          type="datetime-local"
          required
          defaultValue={startsAtLocal}
        />
      </div>

      {/* Format */}
      <div className="space-y-1">
        <Label htmlFor="format">Format</Label>
        <select
          id="format"
          name="format"
          defaultValue={tournament?.format ?? 'best_ball'}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="best_ball">Best Ball</option>
          <option value="stroke_gross">Stroke Play (Gross)</option>
          <option value="stroke_net">Stroke Play (Net)</option>
          <option value="stableford">Stableford</option>
        </select>
      </div>

      {/* Start Style */}
      <div className="space-y-1">
        <Label htmlFor="start_style">Start Style</Label>
        <select
          id="start_style"
          name="start_style"
          defaultValue={tournament?.start_style ?? 'shotgun'}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="shotgun">Shotgun</option>
          <option value="sequential">Sequential</option>
        </select>
      </div>

      {/* Holes Count */}
      <div className="space-y-1">
        <Label htmlFor="holes_count">Holes</Label>
        <select
          id="holes_count"
          name="holes_count"
          defaultValue={tournament?.holes_count ?? 18}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="9">9</option>
          <option value="18">18</option>
        </select>
      </div>

      {/* Server-side error */}
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <SubmitButton editMode={editMode} />
    </form>
  )
}
