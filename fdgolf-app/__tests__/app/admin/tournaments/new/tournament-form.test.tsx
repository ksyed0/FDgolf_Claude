import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
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

vi.mock('@/lib/actions/courses', () => ({
  getCoursesForVenueAction: vi.fn().mockResolvedValue([]),
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
    render(<TournamentForm venues={[]} />)
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
  })

  it('renders a Venue field', () => {
    render(<TournamentForm venues={[]} />)
    expect(screen.getByLabelText(/venue/i)).toBeInTheDocument()
  })

  it('renders a Start Date & Time field', () => {
    render(<TournamentForm venues={[]} />)
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
  })

  it('renders a Format select with default best_ball', () => {
    render(<TournamentForm venues={[]} />)
    const select = screen.getByRole('combobox', { name: /format/i }) as HTMLSelectElement
    expect(select).toBeInTheDocument()
    expect(select.value).toBe('best_ball')
  })

  it('renders a Start Style select with default shotgun', () => {
    render(<TournamentForm venues={[]} />)
    const select = screen.getByRole('combobox', { name: /start style/i }) as HTMLSelectElement
    expect(select).toBeInTheDocument()
    expect(select.value).toBe('shotgun')
  })

  it('renders a Holes Count select with default 18', () => {
    render(<TournamentForm venues={[]} />)
    const select = screen.getByRole('combobox', { name: /holes/i }) as HTMLSelectElement
    expect(select).toBeInTheDocument()
    expect(select.value).toBe('18')
  })

  it('renders a Create Tournament submit button', () => {
    render(<TournamentForm venues={[]} />)
    expect(screen.getByRole('button', { name: /create tournament/i })).toBeInTheDocument()
  })

  it('does not show server error when state.error is null', () => {
    mockState = { error: null }
    render(<TournamentForm venues={[]} />)
    expect(screen.queryByText(/tournament name is required/i)).not.toBeInTheDocument()
  })

  it('shows error message when state has an error', () => {
    mockState = { error: 'Tournament name is required.' }
    render(<TournamentForm venues={[]} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Tournament name is required.')
  })

  // US-0010 slug field tests (AC-0047, AC-0048, AC-0049)
  it('renders slug field with label "URL Slug"', () => {
    render(<TournamentForm venues={[]} />)
    expect(screen.getByLabelText(/url slug/i)).toBeInTheDocument()
  })

  it('slug field has correct name attribute', () => {
    render(<TournamentForm venues={[]} />)
    const slugInput = screen.getByLabelText(/url slug/i) as HTMLInputElement
    expect(slugInput.name).toBe('slug_override')
  })

  it('shows format error for invalid slug characters', () => {
    render(<TournamentForm venues={[]} />)
    const slugInput = screen.getByLabelText(/url slug/i)
    fireEvent.change(slugInput, { target: { value: 'CAPS!' } })
    expect(screen.getByRole('alert')).toHaveTextContent(/only lowercase letters/i)
  })

  it('clears slug error when valid characters entered', () => {
    render(<TournamentForm venues={[]} />)
    const slugInput = screen.getByLabelText(/url slug/i)
    fireEvent.change(slugInput, { target: { value: 'CAPS!' } })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.change(slugInput, { target: { value: 'valid-slug' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('handleSlugBlur: no-ops when slug is empty', async () => {
    const { checkSlugAvailableAction } = await import('@/lib/actions/tournaments')
    render(<TournamentForm venues={[]} />)
    const slugInput = screen.getByLabelText(/url slug/i)
    await act(async () => {
      fireEvent.blur(slugInput)
    })
    expect(checkSlugAvailableAction).not.toHaveBeenCalled()
  })

  it('handleSlugBlur: no-ops when slug has invalid characters', async () => {
    const { checkSlugAvailableAction } = await import('@/lib/actions/tournaments')
    render(<TournamentForm venues={[]} />)
    const slugInput = screen.getByLabelText(/url slug/i)
    fireEvent.change(slugInput, { target: { value: 'CAPS!' } })
    await act(async () => {
      fireEvent.blur(slugInput)
    })
    expect(checkSlugAvailableAction).not.toHaveBeenCalled()
  })

  it('handleSlugBlur: calls checkSlugAvailableAction for valid slug', async () => {
    const { checkSlugAvailableAction } = await import('@/lib/actions/tournaments')
    render(<TournamentForm venues={[]} />)
    const slugInput = screen.getByLabelText(/url slug/i)
    fireEvent.change(slugInput, { target: { value: 'my-tourney' } })
    await act(async () => {
      fireEvent.blur(slugInput)
    })
    expect(checkSlugAvailableAction).toHaveBeenCalledWith('my-tourney')
  })

  it('handleSlugBlur: shows taken error when slug unavailable', async () => {
    const { checkSlugAvailableAction } = await import('@/lib/actions/tournaments')
    vi.mocked(checkSlugAvailableAction).mockResolvedValueOnce({ available: false })
    render(<TournamentForm venues={[]} />)
    const slugInput = screen.getByLabelText(/url slug/i)
    fireEvent.change(slugInput, { target: { value: 'taken-slug' } })
    await act(async () => {
      fireEvent.blur(slugInput)
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/already taken/i)
  })

  it('handleNameChange: updates slug via debounce', async () => {
    vi.useFakeTimers()
    render(<TournamentForm venues={[]} />)
    const nameInput = screen.getByLabelText(/^name$/i)
    fireEvent.change(nameInput, { target: { value: 'My Great Tournament' } })
    await act(async () => {
      vi.advanceTimersByTime(400)
    })
    const slugInput = screen.getByLabelText(/url slug/i) as HTMLInputElement
    expect(slugInput.value).toBe('my-great-tournament')
    vi.useRealTimers()
  })
})
