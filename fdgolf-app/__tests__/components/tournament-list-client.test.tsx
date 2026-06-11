import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'

const mockDeleteAction = vi.hoisted(() => vi.fn())
const mockRouterRefresh = vi.hoisted(() => vi.fn())

vi.mock('@/lib/actions/tournaments', () => ({
  deleteTournamentAction: mockDeleteAction,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}))

import { TournamentListClient } from '@/app/admin/tournaments/tournament-list-client'

const DRAFT_TOURNAMENT = {
  id: 't-1', slug: 'spring-open', name: 'Spring Open',
  status: 'draft', starts_at: '2026-07-01T10:00:00Z',
  venues: { name: 'Granite Ridge GC' },
}
const ACTIVE_TOURNAMENT = {
  id: 't-2', slug: 'summer-cup', name: 'Summer Cup',
  status: 'active', starts_at: '2026-08-01T10:00:00Z',
  venues: null,
}

beforeEach(() => {
  vi.resetAllMocks()
  mockDeleteAction.mockResolvedValue({ error: null })
})

describe('TournamentListClient', () => {
  it('renders tournament name, venue, and status', () => {
    render(<TournamentListClient tournaments={[DRAFT_TOURNAMENT]} />)
    expect(screen.getByText('Spring Open')).toBeInTheDocument()
    expect(screen.getByText(/Granite Ridge GC/)).toBeInTheDocument()
    expect(screen.getByText(/draft/i)).toBeInTheDocument()
  })

  it('renders Edit link pointing to /edit', () => {
    render(<TournamentListClient tournaments={[DRAFT_TOURNAMENT]} />)
    const editLink = screen.getByRole('link', { name: /edit/i })
    expect(editLink).toHaveAttribute('href', '/admin/tournaments/spring-open/edit')
  })

  it('shows confirm row on Delete click for draft tournament', () => {
    render(<TournamentListClient tournaments={[DRAFT_TOURNAMENT]} />)
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm delete/i })).toBeInTheDocument()
  })

  it('shows "only draft tournaments" message for active tournament', () => {
    render(<TournamentListClient tournaments={[ACTIVE_TOURNAMENT]} />)
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(screen.getByText(/only draft tournaments/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /confirm delete/i })).not.toBeInTheDocument()
  })

  it('calls deleteTournamentAction with correct id on confirm', async () => {
    render(<TournamentListClient tournaments={[DRAFT_TOURNAMENT]} />)
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }))
    })
    expect(mockDeleteAction).toHaveBeenCalledWith('t-1')
  })

  it('calls router.refresh() on successful delete', async () => {
    render(<TournamentListClient tournaments={[DRAFT_TOURNAMENT]} />)
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }))
    })
    expect(mockRouterRefresh).toHaveBeenCalled()
  })

  it('shows error when deleteTournamentAction returns error', async () => {
    mockDeleteAction.mockResolvedValue({ error: 'Only draft tournaments can be deleted.' })
    render(<TournamentListClient tournaments={[DRAFT_TOURNAMENT]} />)
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/draft/i)
  })

  it('hides confirm row on Cancel', () => {
    render(<TournamentListClient tournaments={[DRAFT_TOURNAMENT]} />)
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByText(/cannot be undone/i)).not.toBeInTheDocument()
  })

  it('renders "+ New tournament" button', () => {
    render(<TournamentListClient tournaments={[]} />)
    expect(screen.getByRole('link', { name: /new tournament/i })).toBeInTheDocument()
  })
})
