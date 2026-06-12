import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

const { mockCreateAction, mockUpdateAction } = vi.hoisted(() => ({
  mockCreateAction: vi.fn(),
  mockUpdateAction: vi.fn(),
}))

vi.mock('@/lib/actions/venues', () => ({
  createVenueAction: mockCreateAction,
  updateVenueAction: mockUpdateAction,
}))

const mockFormAction = vi.fn()
let mockState: { error: string | null } = { error: null }

vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>()
  return {
    ...actual,
    useFormState: vi.fn((_action: unknown, _init: unknown) => [mockState, mockFormAction]),
    useFormStatus: vi.fn(() => ({ pending: false })),
  }
})

import { VenueForm } from '@/app/admin/venues/new/venue-form'

beforeEach(() => {
  mockState = { error: null }
  vi.clearAllMocks()
})

describe('VenueForm — create mode', () => {
  it('renders name input', () => {
    render(<VenueForm />)
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
  })

  it('renders all address fields', () => {
    render(<VenueForm />)
    expect(screen.getByLabelText(/address line 1/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/state/i)).toBeInTheDocument()
  })

  it('renders "Create venue" submit button', () => {
    render(<VenueForm />)
    expect(screen.getByRole('button', { name: /create venue/i })).toBeInTheDocument()
  })

  it('shows error when returned from action', () => {
    mockState = { error: 'Venue name is required.' }
    render(<VenueForm />)
    expect(screen.getByRole('alert')).toHaveTextContent('Venue name is required.')
  })

  it('does not show error when state.error is null', () => {
    mockState = { error: null }
    render(<VenueForm />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('VenueForm — edit mode', () => {
  const venue = {
    id: 'v-1',
    name: 'Granite Ridge GC',
    address1: '123 Golf Rd',
    address2: null,
    city: 'Oakville',
    state_province: 'ON',
    zip_postal: 'L6J 1A1',
  }

  it('pre-populates name field', () => {
    render(<VenueForm venue={venue} />)
    expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('Granite Ridge GC')
  })

  it('pre-populates city field', () => {
    render(<VenueForm venue={venue} />)
    expect((screen.getByLabelText(/city/i) as HTMLInputElement).value).toBe('Oakville')
  })

  it('renders "Save changes" submit button', () => {
    render(<VenueForm venue={venue} />)
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })
})
