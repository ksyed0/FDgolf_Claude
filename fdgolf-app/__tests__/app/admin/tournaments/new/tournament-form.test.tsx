import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TournamentForm } from '@/app/admin/tournaments/new/tournament-form'

// Mock the server action
vi.mock('@/lib/actions/tournaments', () => ({
  createTournamentAction: vi.fn(),
}))

const mockFormAction = vi.fn()
let mockState: { error: string | null } = { error: null }

vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>()
  return {
    ...actual,
    useFormState: vi.fn((_action, _init) => [mockState, mockFormAction]),
    useFormStatus: vi.fn(() => ({ pending: false })),
  }
})

describe('TournamentForm', () => {
  beforeEach(() => {
    mockState = { error: null }
    vi.clearAllMocks()
  })

  it('renders a Name field', () => {
    render(<TournamentForm />)
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
  })

  it('renders a Venue field', () => {
    render(<TournamentForm />)
    expect(screen.getByLabelText(/venue/i)).toBeInTheDocument()
  })

  it('renders a Start Date & Time field', () => {
    render(<TournamentForm />)
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
  })

  it('renders a Format select with default best_ball', () => {
    render(<TournamentForm />)
    const select = screen.getByRole('combobox', { name: /format/i }) as HTMLSelectElement
    expect(select).toBeInTheDocument()
    expect(select.value).toBe('best_ball')
  })

  it('renders a Start Style select with default shotgun', () => {
    render(<TournamentForm />)
    const select = screen.getByRole('combobox', { name: /start style/i }) as HTMLSelectElement
    expect(select).toBeInTheDocument()
    expect(select.value).toBe('shotgun')
  })

  it('renders a Holes Count select with default 18', () => {
    render(<TournamentForm />)
    const select = screen.getByRole('combobox', { name: /holes/i }) as HTMLSelectElement
    expect(select).toBeInTheDocument()
    expect(select.value).toBe('18')
  })

  it('renders a Create Tournament submit button', () => {
    render(<TournamentForm />)
    expect(screen.getByRole('button', { name: /create tournament/i })).toBeInTheDocument()
  })

  it('does not show error when state.error is null', () => {
    mockState = { error: null }
    render(<TournamentForm />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows error message when state has an error', () => {
    mockState = { error: 'Tournament name is required.' }
    render(<TournamentForm />)
    expect(screen.getByRole('alert')).toHaveTextContent('Tournament name is required.')
  })
})
