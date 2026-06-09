import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSearchPlayers, mockAssignOrganizer } = vi.hoisted(() => ({
  mockSearchPlayers: vi.fn(),
  mockAssignOrganizer: vi.fn(),
}))

vi.mock('@/lib/actions/roles', () => ({
  searchPlayersAction: mockSearchPlayers,
  assignOrganizerAction: mockAssignOrganizer,
}))

import { OrganizerSearch } from '@/components/organizer-search'

const DEFAULT_PROPS = {
  tournamentId: 'tournament-uuid-001',
  tournamentName: 'Spring Open 2026',
}

describe('OrganizerSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the search input and button', () => {
    render(<OrganizerSearch {...DEFAULT_PROPS} />)

    expect(
      screen.getByPlaceholderText('Search players by name…')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
  })

  it('disables the Search button when query is empty', () => {
    render(<OrganizerSearch {...DEFAULT_PROPS} />)

    expect(screen.getByRole('button', { name: /search/i })).toBeDisabled()
  })

  it('shows player results after a successful search', async () => {
    mockSearchPlayers.mockResolvedValue({
      players: [
        { id: 'p1', name: 'Alice Smith', email: 'alice@example.com' },
      ],
      error: null,
    })

    render(<OrganizerSearch {...DEFAULT_PROPS} />)

    fireEvent.change(
      screen.getByPlaceholderText('Search players by name…'),
      { target: { value: 'Alice' } }
    )
    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument()
      expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    })

    expect(
      screen.getByRole('button', { name: /make organizer/i })
    ).toBeInTheDocument()
  })

  it('shows "No players found." when search returns empty', async () => {
    mockSearchPlayers.mockResolvedValue({ players: [], error: null })

    render(<OrganizerSearch {...DEFAULT_PROPS} />)

    fireEvent.change(
      screen.getByPlaceholderText('Search players by name…'),
      { target: { value: 'zzz' } }
    )
    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    await waitFor(() => {
      expect(screen.getByText('No players found.')).toBeInTheDocument()
    })
  })

  it('shows success message after "Make organizer" is clicked', async () => {
    mockSearchPlayers.mockResolvedValue({
      players: [{ id: 'p1', name: 'Bob Lee', email: 'bob@example.com' }],
      error: null,
    })
    mockAssignOrganizer.mockResolvedValue({ error: null })

    render(<OrganizerSearch {...DEFAULT_PROPS} />)

    fireEvent.change(
      screen.getByPlaceholderText('Search players by name…'),
      { target: { value: 'Bob' } }
    )
    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /make organizer/i })).toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole('button', { name: /make organizer/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/Assigned as organizer for Spring Open 2026/i)
      ).toBeInTheDocument()
    })

    expect(
      screen.getByRole('button', { name: /organizer assigned/i })
    ).toBeDisabled()
  })

  it('shows error message when assignment fails', async () => {
    mockSearchPlayers.mockResolvedValue({
      players: [{ id: 'p1', name: 'Bob Lee', email: 'bob@example.com' }],
      error: null,
    })
    mockAssignOrganizer.mockResolvedValue({
      error: 'Unauthorized: admin role required',
    })

    render(<OrganizerSearch {...DEFAULT_PROPS} />)

    fireEvent.change(
      screen.getByPlaceholderText('Search players by name…'),
      { target: { value: 'Bob' } }
    )
    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /make organizer/i })).toBeInTheDocument()
    )

    fireEvent.click(screen.getByRole('button', { name: /make organizer/i }))

    await waitFor(() => {
      expect(
        screen.getByText('Unauthorized: admin role required')
      ).toBeInTheDocument()
    })
  })

  it('shows search error when searchPlayersAction returns an error', async () => {
    mockSearchPlayers.mockResolvedValue({
      players: [],
      error: 'connection refused',
    })

    render(<OrganizerSearch {...DEFAULT_PROPS} />)

    fireEvent.change(
      screen.getByPlaceholderText('Search players by name…'),
      { target: { value: 'Alice' } }
    )
    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('connection refused')
    })
  })
})
