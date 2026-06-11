import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock the server action
vi.mock('@/lib/actions/clubs', () => ({
  saveClubsAction: vi.fn(),
}))

// Mock useFormState and useFormStatus following the project pattern from
// __tests__/app/admin/tournaments/course-holes-form.test.tsx
const mockFormAction = vi.fn()
let mockState: { error: string | null; success: boolean } = { error: null, success: false }

vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>()
  return {
    ...actual,
    useFormState: vi.fn((_action, _initialState) => [mockState, mockFormAction]),
    useFormStatus: vi.fn(() => ({ pending: false })),
  }
})

import { ClubPickerForm, Club } from '@/app/admin/tournaments/[slug]/clubs/club-picker-form'

const sampleClubs: Club[] = [
  { id: 'club-1', display_name: 'Driver', club_type: 'wood', display_order: 1 },
  { id: 'club-2', display_name: '5-Iron', club_type: 'iron', display_order: 5 },
  { id: 'club-3', display_name: 'Putter', club_type: 'putter', display_order: 15 },
]

const defaultProps = {
  tournamentId: 'tournament-uuid-1',
  tournamentName: 'Summer Classic',
  allClubs: sampleClubs,
  activeClubIds: [],
}

describe('ClubPickerForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState = { error: null, success: false }
  })

  // ── Rendering ────────────────────────────────────────────────────────────────

  it('renders tournament name in heading', () => {
    render(<ClubPickerForm {...defaultProps} />)
    expect(
      screen.getByRole('heading', { name: /Available Clubs — Summer Classic/i })
    ).toBeInTheDocument()
  })

  it('renders a toggle for every club', () => {
    render(<ClubPickerForm {...defaultProps} />)
    const toggles = screen.getAllByRole('switch')
    expect(toggles).toHaveLength(sampleClubs.length)
  })

  it('renders club display names', () => {
    render(<ClubPickerForm {...defaultProps} />)
    expect(screen.getByText('Driver')).toBeInTheDocument()
    expect(screen.getByText('5-Iron')).toBeInTheDocument()
    expect(screen.getByText('Putter')).toBeInTheDocument()
  })

  // ── Default "all active" when activeClubIds is empty (no-rows invariant) ───

  it('defaults all clubs to active when activeClubIds is empty', () => {
    render(<ClubPickerForm {...defaultProps} activeClubIds={[]} />)
    const toggles = screen.getAllByRole('switch')
    for (const toggle of toggles) {
      expect(toggle).toHaveAttribute('aria-checked', 'true')
    }
  })

  it('shows correct active count when all clubs are default-active', () => {
    render(<ClubPickerForm {...defaultProps} activeClubIds={[]} />)
    expect(screen.getByText(`${sampleClubs.length} of ${sampleClubs.length} clubs active`)).toBeInTheDocument()
  })

  // ── Partial active set from existing tournament_clubs rows ───────────────────

  it('respects existing activeClubIds — only those clubs are toggled on', () => {
    render(<ClubPickerForm {...defaultProps} activeClubIds={['club-1', 'club-3']} />)
    const toggles = screen.getAllByRole('switch')
    // club-1 → on, club-2 → off, club-3 → on
    expect(toggles[0]).toHaveAttribute('aria-checked', 'true')
    expect(toggles[1]).toHaveAttribute('aria-checked', 'false')
    expect(toggles[2]).toHaveAttribute('aria-checked', 'true')
  })

  it('shows correct active count with partial active set', () => {
    render(<ClubPickerForm {...defaultProps} activeClubIds={['club-1']} />)
    expect(screen.getByText('1 of 3 clubs active')).toBeInTheDocument()
  })

  // ── Toggle interaction ───────────────────────────────────────────────────────

  it('toggles a club off when clicked while active', () => {
    render(<ClubPickerForm {...defaultProps} />)
    const driverToggle = screen.getByRole('switch', { name: /Toggle Driver/i })
    expect(driverToggle).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(driverToggle)

    expect(driverToggle).toHaveAttribute('aria-checked', 'false')
  })

  it('toggles a club on when clicked while inactive', () => {
    render(<ClubPickerForm {...defaultProps} activeClubIds={['club-1']} />)
    const ironToggle = screen.getByRole('switch', { name: /Toggle 5-Iron/i })
    expect(ironToggle).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(ironToggle)

    expect(ironToggle).toHaveAttribute('aria-checked', 'true')
  })

  it('updates the active count when a club is toggled off', () => {
    render(<ClubPickerForm {...defaultProps} />)
    expect(screen.getByText('3 of 3 clubs active')).toBeInTheDocument()

    const driverToggle = screen.getByRole('switch', { name: /Toggle Driver/i })
    fireEvent.click(driverToggle)

    expect(screen.getByText('2 of 3 clubs active')).toBeInTheDocument()
  })

  // ── Hidden inputs for FormData ───────────────────────────────────────────────

  it('renders hidden tournament_id input inside the form', () => {
    render(<ClubPickerForm {...defaultProps} tournamentId="tid-999" />)
    const tidInput = document.querySelector('input[name="tournament_id"]') as HTMLInputElement
    expect(tidInput).not.toBeNull()
    expect(tidInput.value).toBe('tid-999')
  })

  it('renders hidden active_club_id inputs for all active clubs inside the form', () => {
    render(<ClubPickerForm {...defaultProps} activeClubIds={[]} />)
    // All 3 clubs default-active → 3 hidden inputs
    const hiddenInputs = Array.from(
      document.querySelectorAll('input[name="active_club_id"]')
    ) as HTMLInputElement[]
    expect(hiddenInputs).toHaveLength(3)
    const values = hiddenInputs.map((el) => el.value)
    expect(values).toContain('club-1')
    expect(values).toContain('club-2')
    expect(values).toContain('club-3')
  })

  it('removes hidden input for a club when it is toggled off', () => {
    render(<ClubPickerForm {...defaultProps} activeClubIds={[]} />)

    const driverToggle = screen.getByRole('switch', { name: /Toggle Driver/i })
    fireEvent.click(driverToggle)

    const hiddenInputs = Array.from(
      document.querySelectorAll('input[name="active_club_id"]')
    ) as HTMLInputElement[]
    const values = hiddenInputs.map((el) => el.value)
    expect(values).not.toContain('club-1')
    expect(values).toContain('club-2')
    expect(values).toContain('club-3')
  })

  // ── Error and success states ──────────────────────────────────────────────────

  it('shows error message from server action', () => {
    mockState = { error: 'DB error: constraint violation', success: false }
    render(<ClubPickerForm {...defaultProps} />)
    expect(screen.getByRole('alert')).toHaveTextContent('DB error: constraint violation')
  })

  it('shows success banner when state.success is true', () => {
    mockState = { error: null, success: true }
    render(<ClubPickerForm {...defaultProps} />)
    expect(screen.getByRole('status')).toHaveTextContent('Club selection saved!')
  })

  it('does not show success banner when state.success is false', () => {
    mockState = { error: null, success: false }
    render(<ClubPickerForm {...defaultProps} />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  // ── Empty state ───────────────────────────────────────────────────────────────

  it('renders empty state message when no clubs are provided', () => {
    render(<ClubPickerForm {...defaultProps} allClubs={[]} />)
    expect(screen.getByText(/No clubs found/i)).toBeInTheDocument()
  })
})
