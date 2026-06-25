import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatusPill } from '@/components/admin/status-pill'
import { TournamentListClient } from '@/app/admin/tournaments/tournament-list-client'

// Mock next/navigation for filter chip tests
const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin/tournaments',
}))

// Mock the delete action
vi.mock('@/lib/actions/tournaments', () => ({
  deleteTournamentAction: vi.fn().mockResolvedValue({ error: null }),
}))

const MOCK_TOURNAMENTS = [
  { id: '1', slug: 'a', name: 'Alpha', status: 'draft', starts_at: null, venues: null },
  { id: '2', slug: 'b', name: 'Beta', status: 'active', starts_at: null, venues: null },
]

describe('StatusPill', () => {
  it('renders draft with grey styling', () => {
    render(<StatusPill status="draft" />)
    const pill = screen.getByText('Draft')
    expect(pill).toHaveClass('bg-gray-100')
  })

  it('renders registration_open with blue styling', () => {
    render(<StatusPill status="registration_open" />)
    const pill = screen.getByText('Registration Open')
    expect(pill).toHaveClass('bg-blue-100')
  })

  it('renders active with green styling', () => {
    render(<StatusPill status="active" />)
    expect(screen.getByText('Active')).toHaveClass('bg-green-100')
  })

  it('renders completed with slate styling', () => {
    render(<StatusPill status="completed" />)
    expect(screen.getByText('Completed')).toHaveClass('bg-slate-100')
  })

  it('renders cancelled with red styling', () => {
    render(<StatusPill status="cancelled" />)
    expect(screen.getByText('Cancelled')).toHaveClass('bg-red-100')
  })

  it('renders unknown status with fallback grey styling', () => {
    render(<StatusPill status="unknown_status" />)
    expect(screen.getByText('unknown_status')).toHaveClass('bg-gray-100')
  })
})

describe('TournamentListClient filter chips', () => {
  beforeEach(() => {
    mockReplace.mockClear()
  })

  it('shows All chip as active by default', () => {
    render(<TournamentListClient tournaments={MOCK_TOURNAMENTS} />)
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('data-active', 'true')
  })

  it('navigates with status param on chip click', async () => {
    render(<TournamentListClient tournaments={MOCK_TOURNAMENTS} />)
    await userEvent.click(screen.getByRole('button', { name: 'Active' }))
    expect(mockReplace).toHaveBeenCalledWith('/admin/tournaments?status=active')
  })

  it('navigates without status param when All chip is clicked', async () => {
    render(<TournamentListClient tournaments={MOCK_TOURNAMENTS} />)
    await userEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(mockReplace).toHaveBeenCalledWith('/admin/tournaments')
  })

  it('renders StatusPill for each tournament', () => {
    render(<TournamentListClient tournaments={MOCK_TOURNAMENTS} />)
    // "Draft" appears in both the filter chip and the StatusPill
    expect(screen.getAllByText('Draft').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
  })

  it('renders all filter chips', () => {
    render(<TournamentListClient tournaments={MOCK_TOURNAMENTS} />)
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Draft' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registration Open' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Active' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Completed' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelled' })).toBeInTheDocument()
  })

  it('shows empty state when no tournaments', () => {
    render(<TournamentListClient tournaments={[]} />)
    expect(screen.getByText('No tournaments yet.')).toBeInTheDocument()
  })
})
