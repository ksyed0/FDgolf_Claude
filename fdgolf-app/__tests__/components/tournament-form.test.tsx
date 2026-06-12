import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { mockCreateAction, mockUpdateAction, mockCheckSlugAction, mockGetCourses } = vi.hoisted(
  () => ({
    mockCreateAction: vi.fn(),
    mockUpdateAction: vi.fn(),
    mockCheckSlugAction: vi.fn(),
    mockGetCourses: vi.fn(),
  })
)

vi.mock('@/lib/actions/tournaments', () => ({
  createTournamentAction: mockCreateAction,
  updateTournamentAction: mockUpdateAction,
  checkSlugAvailableAction: mockCheckSlugAction,
}))

vi.mock('@/lib/actions/courses', () => ({
  getCoursesForVenueAction: mockGetCourses,
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

import { TournamentForm } from '@/app/admin/tournaments/new/tournament-form'

// ---------------------------------------------------------------------------
// Shared test fixture
// ---------------------------------------------------------------------------
const tournament = {
  id: 't-1',
  name: 'Spring Open',
  slug: 'spring-open',
  venue_id: 'v-1',
  course_id: 'c-1',
  starts_at: '2026-07-01T10:00:00Z',
  format: 'best_ball',
  start_style: 'shotgun',
  holes_count: 18,
}

beforeEach(() => {
  mockState = { error: null }
  vi.clearAllMocks()
  mockCheckSlugAction.mockResolvedValue({ available: true })
  mockGetCourses.mockResolvedValue([])
})

// ---------------------------------------------------------------------------
// Create mode
// ---------------------------------------------------------------------------
describe('TournamentForm — create mode', () => {
  it('renders name input', () => {
    render(<TournamentForm venues={[]} />)
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
  })

  it('renders slug input in create mode', () => {
    render(<TournamentForm venues={[]} />)
    expect(screen.getByLabelText(/url slug/i)).toBeInTheDocument()
  })

  it('renders "Create tournament" submit button', () => {
    render(<TournamentForm venues={[]} />)
    expect(screen.getByRole('button', { name: /create tournament/i })).toBeInTheDocument()
  })

  it('shows error when returned from action', () => {
    mockState = { error: 'Tournament name is required.' }
    render(<TournamentForm venues={[]} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Tournament name is required.')
  })

  it('does not show error when state.error is null', () => {
    mockState = { error: null }
    render(<TournamentForm venues={[]} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows slug validation error for invalid characters', () => {
    render(<TournamentForm venues={[]} />)
    const slugInput = screen.getByLabelText(/url slug/i)
    fireEvent.change(slugInput, { target: { value: 'INVALID SLUG!' } })
    expect(screen.getByRole('alert')).toHaveTextContent(/lowercase letters/i)
  })

  it('shows taken error when slug is not available', async () => {
    mockCheckSlugAction.mockResolvedValue({ available: false })
    render(<TournamentForm venues={[]} />)
    const slugInput = screen.getByLabelText(/url slug/i)
    fireEvent.change(slugInput, { target: { value: 'taken-slug' } })
    fireEvent.blur(slugInput)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/already taken/i)
    })
  })

  it('renders format select with best_ball default', () => {
    render(<TournamentForm venues={[]} />)
    const formatSelect = screen.getByLabelText(/format/i) as HTMLSelectElement
    expect(formatSelect.value).toBe('best_ball')
  })

  it('renders start style select with shotgun default', () => {
    render(<TournamentForm venues={[]} />)
    const startStyleSelect = screen.getByLabelText(/start style/i) as HTMLSelectElement
    expect(startStyleSelect.value).toBe('shotgun')
  })

  it('renders holes count select with 18 default', () => {
    render(<TournamentForm venues={[]} />)
    const holesSelect = screen.getByLabelText(/holes/i) as HTMLSelectElement
    expect(holesSelect.value).toBe('18')
  })
})

// ---------------------------------------------------------------------------
// Edit mode
// ---------------------------------------------------------------------------
describe('TournamentForm — edit mode', () => {
  it('pre-populates name field', () => {
    render(<TournamentForm venues={[]} tournament={tournament} />)
    expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('Spring Open')
  })

  it('shows "Save changes" button in edit mode', () => {
    render(<TournamentForm venues={[]} tournament={tournament} />)
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })

  it('does not show slug input in edit mode', () => {
    render(<TournamentForm venues={[]} tournament={tournament} />)
    expect(screen.queryByLabelText(/url slug/i)).not.toBeInTheDocument()
  })

  it('shows read-only slug note in edit mode', () => {
    render(<TournamentForm venues={[]} tournament={tournament} />)
    expect(screen.getByText(/cannot be changed/i)).toBeInTheDocument()
  })

  it('pre-populates format from tournament', () => {
    render(<TournamentForm venues={[]} tournament={{ ...tournament, format: 'stableford' }} />)
    const formatSelect = screen.getByLabelText(/format/i) as HTMLSelectElement
    expect(formatSelect.value).toBe('stableford')
  })

  it('pre-populates start_style from tournament', () => {
    render(<TournamentForm venues={[]} tournament={{ ...tournament, start_style: 'sequential' }} />)
    const startStyleSelect = screen.getByLabelText(/start style/i) as HTMLSelectElement
    expect(startStyleSelect.value).toBe('sequential')
  })

  it('pre-populates holes_count from tournament', () => {
    render(<TournamentForm venues={[]} tournament={{ ...tournament, holes_count: 9 }} />)
    const holesSelect = screen.getByLabelText(/holes/i) as HTMLSelectElement
    expect(holesSelect.value).toBe('9')
  })
})

// ---------------------------------------------------------------------------
// Venue / Course cascade
// ---------------------------------------------------------------------------
describe('TournamentForm — venue/course cascade', () => {
  it('renders venue dropdown', () => {
    render(<TournamentForm venues={[{ id: 'v-1', name: 'Granite Ridge' }]} />)
    expect(screen.getByLabelText(/venue/i)).toBeInTheDocument()
  })

  it('populates venue options from venues prop', () => {
    render(<TournamentForm venues={[{ id: 'v-1', name: 'Granite Ridge' }]} />)
    expect(screen.getByRole('option', { name: 'Granite Ridge' })).toBeInTheDocument()
  })

  it('course select is disabled when no venue selected', () => {
    render(<TournamentForm venues={[{ id: 'v-1', name: 'Granite Ridge' }]} />)
    const courseSelect = screen.getByLabelText(/course/i)
    expect(courseSelect).toBeDisabled()
  })

  it('course select is enabled after selecting a venue', async () => {
    mockGetCourses.mockResolvedValue([{ id: 'c-1', name: 'North Course' }])
    render(<TournamentForm venues={[{ id: 'v-1', name: 'Granite Ridge' }]} />)
    const venueSelect = screen.getByLabelText(/venue/i)
    fireEvent.change(venueSelect, { target: { value: 'v-1' } })
    await waitFor(() => {
      expect(screen.getByLabelText(/course/i)).not.toBeDisabled()
    })
  })

  it('populates course options after selecting a venue', async () => {
    mockGetCourses.mockResolvedValue([{ id: 'c-1', name: 'North Course' }])
    render(<TournamentForm venues={[{ id: 'v-1', name: 'Granite Ridge' }]} />)
    const venueSelect = screen.getByLabelText(/venue/i)
    fireEvent.change(venueSelect, { target: { value: 'v-1' } })
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'North Course' })).toBeInTheDocument()
    })
  })

  it('clears course options when venue is deselected', async () => {
    mockGetCourses.mockResolvedValue([{ id: 'c-1', name: 'North Course' }])
    render(<TournamentForm venues={[{ id: 'v-1', name: 'Granite Ridge' }]} />)
    const venueSelect = screen.getByLabelText(/venue/i)
    fireEvent.change(venueSelect, { target: { value: 'v-1' } })
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'North Course' })).toBeInTheDocument()
    })
    fireEvent.change(venueSelect, { target: { value: '' } })
    await waitFor(() => {
      expect(screen.queryByRole('option', { name: 'North Course' })).not.toBeInTheDocument()
    })
  })

  it('fetches courses for pre-selected venue in edit mode', async () => {
    mockGetCourses.mockResolvedValue([{ id: 'c-1', name: 'Championship Course' }])
    render(
      <TournamentForm venues={[{ id: 'v-1', name: 'Granite Ridge' }]} tournament={tournament} />
    )
    await waitFor(() => {
      expect(mockGetCourses).toHaveBeenCalledWith('v-1')
    })
  })
})
