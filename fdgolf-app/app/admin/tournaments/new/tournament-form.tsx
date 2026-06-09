'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { createTournamentAction } from '@/lib/actions/tournaments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState = { error: null as string | null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Creating…' : 'Create Tournament'}
    </Button>
  )
}

/**
 * TournamentForm — Client Component for tournament creation (US-0009).
 *
 * Fields (AC-0044):
 *   - name (required)
 *   - venue (required)
 *   - starts_at datetime-local (required)
 *   - format select, default best_ball
 *   - start_style select, default shotgun
 *   - holes_count select, default 18
 */
export function TournamentForm() {
  const [state, formAction] = useFormState(createTournamentAction, initialState)

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
        />
      </div>

      {/* Venue */}
      <div className="space-y-1">
        <Label htmlFor="venue">Venue</Label>
        <Input
          id="venue"
          name="venue"
          type="text"
          required
          placeholder="e.g. Pine Valley Golf Club"
        />
      </div>

      {/* Start Date & Time */}
      <div className="space-y-1">
        <Label htmlFor="starts_at">Start Date &amp; Time</Label>
        <Input
          id="starts_at"
          name="starts_at"
          type="datetime-local"
          required
        />
      </div>

      {/* Format */}
      <div className="space-y-1">
        <Label htmlFor="format">Format</Label>
        <select
          id="format"
          name="format"
          defaultValue="best_ball"
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
          defaultValue="shotgun"
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
          defaultValue="18"
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

      <SubmitButton />
    </form>
  )
}
