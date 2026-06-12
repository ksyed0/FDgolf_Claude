'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { createVenueAction, updateVenueAction } from '@/lib/actions/venues'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ExistingVenue = {
  id: string
  name: string
  address1: string | null
  address2: string | null
  city: string | null
  state_province: string | null
  zip_postal: string | null
}

interface VenueFormProps {
  venue?: ExistingVenue
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

export function VenueForm({ venue }: VenueFormProps) {
  const isEdit = Boolean(venue)
  const action = isEdit ? updateVenueAction.bind(null, venue!.id) : createVenueAction

  const [state, formAction] = useFormState(action, initialState)

  return (
    <form action={formAction} aria-label="venue form" role="form" className="space-y-4 max-w-lg">
      <div className="space-y-1">
        <Label htmlFor="name">Venue name *</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={venue?.name ?? ''}
          placeholder="e.g. Granite Ridge GC"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="address1">Address line 1</Label>
        <Input
          id="address1"
          name="address1"
          defaultValue={venue?.address1 ?? ''}
          placeholder="123 Golf Course Rd"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="address2">Address line 2</Label>
        <Input
          id="address2"
          name="address2"
          defaultValue={venue?.address2 ?? ''}
          placeholder="Suite 100"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={venue?.city ?? ''} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="state_province">State / Province</Label>
          <Input
            id="state_province"
            name="state_province"
            defaultValue={venue?.state_province ?? ''}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="zip_postal">ZIP / Postal code</Label>
        <Input id="zip_postal" name="zip_postal" defaultValue={venue?.zip_postal ?? ''} />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <SubmitButton label={isEdit ? 'Save changes' : 'Create venue'} />
    </form>
  )
}
