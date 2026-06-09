import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TournamentForm } from '@/app/admin/tournaments/new/tournament-form'

// Mock the server actions — include checkSlugAvailableAction for US-0010
vi.mock('@/lib/actions/tournaments', async (importOriginal) => {
  const actual = await importOriginal() as object
  return {
    ...actual,
    createTournamentAction: vi.fn(),
    checkSlugAvailableAction: vi.fn().mockResolvedValue({ available: true }),
  }
})

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

  it('does not show server error when state.error is null', () => {
    mockState = { error: null }
    render(<TournamentForm />)
    expect(screen.queryByText(/tournament name is required/i)).not.toBeInTheDocument()
  })

  it('shows error message when state has an error', () => {
    mockState = { error: 'Tournament name is required.' }
    render(<TournamentForm />)
    expect(screen.getByRole('alert')).toHaveTextContent('Tournament name is required.')
  })

  // US-0010 slug field tests (AC-0047, AC-0048, AC-0049)
  it('renders slug field with label "URL Slug"', () => {
    render(<TournamentForm />)
    expect(screen.getByLabelText(/url slug/i)).toBeInTheDocument()
  })

  it('slug field has correct name attribute', () => {
    render(<TournamentForm />)
    const slugInput = screen.getByLabelText(/url slug/i) as HTMLInputElement
    expect(slugInput.name).toBe('slug_override')
  })

  it('shows format error for invalid slug characters', () => {
    render(<TournamentForm />)
    const slugInput = screen.getByLabelText(/url slug/i)
    fireEvent.change(slugInput, { target: { value: 'CAPS!' } })
    expect(screen.getByRole('alert')).toHaveTextContent(/only lowercase letters/i)
  })
})
