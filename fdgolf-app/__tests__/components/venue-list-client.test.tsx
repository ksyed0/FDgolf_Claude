import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'

const { mockDeleteAction, mockRefresh } = vi.hoisted(() => ({
  mockDeleteAction: vi.fn(),
  mockRefresh: vi.fn(),
}))

vi.mock('@/lib/actions/venues', () => ({
  deleteVenueAction: mockDeleteAction,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

import { VenueListClient } from '@/app/admin/venues/venue-list-client'

const venues = [
  { id: 'v-1', name: 'Granite Ridge GC', city: 'Oakville', state_province: 'ON', courseCount: 2 },
  { id: 'v-2', name: 'Lakeview Links', city: null, state_province: null, courseCount: 0 },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockDeleteAction.mockResolvedValue({ error: null })
})

describe('VenueListClient', () => {
  it('renders all venue names', () => {
    render(<VenueListClient venues={venues} />)
    expect(screen.getByText('Granite Ridge GC')).toBeInTheDocument()
    expect(screen.getByText('Lakeview Links')).toBeInTheDocument()
  })

  it('renders city/province when set', () => {
    render(<VenueListClient venues={venues} />)
    expect(screen.getByText(/Oakville.*ON|ON.*Oakville/)).toBeInTheDocument()
  })

  it('renders course count', () => {
    render(<VenueListClient venues={venues} />)
    expect(screen.getByText(/2 course/i)).toBeInTheDocument()
    expect(screen.getByText(/0 course/i)).toBeInTheDocument()
  })

  it('renders Edit links for each venue', () => {
    render(<VenueListClient venues={venues} />)
    const editLinks = screen.getAllByRole('link', { name: /edit/i })
    expect(editLinks).toHaveLength(2)
    expect(editLinks[0]).toHaveAttribute('href', '/admin/venues/v-1/edit')
  })

  it('renders View links for each venue', () => {
    render(<VenueListClient venues={venues} />)
    const viewLinks = screen.getAllByRole('link', { name: /view/i })
    expect(viewLinks).toHaveLength(2)
    expect(viewLinks[0]).toHaveAttribute('href', '/admin/venues/v-1')
  })

  it('shows delete confirm row on Delete click', () => {
    render(<VenueListClient venues={venues} />)
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    fireEvent.click(deleteButtons[0])
    expect(screen.getByText(/confirm/i)).toBeInTheDocument()
  })

  it('calls deleteVenueAction with correct id on confirm', async () => {
    render(<VenueListClient venues={venues} />)
    fireEvent.click(screen.getAllByRole('button', { name: /delete/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => {
      expect(mockDeleteAction).toHaveBeenCalledWith('v-1')
    })
  })

  it('refreshes router after successful delete', async () => {
    render(<VenueListClient venues={venues} />)
    fireEvent.click(screen.getAllByRole('button', { name: /delete/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('shows error message when delete fails', async () => {
    mockDeleteAction.mockResolvedValue({
      error: 'Cannot delete: 2 tournament(s) reference this venue.',
    })
    render(<VenueListClient venues={venues} />)
    fireEvent.click(screen.getAllByRole('button', { name: /delete/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Cannot delete')
    })
  })

  it('renders + Add venue link', () => {
    render(<VenueListClient venues={venues} />)
    expect(screen.getByRole('link', { name: /add venue/i })).toHaveAttribute(
      'href',
      '/admin/venues/new'
    )
  })

  it('shows empty state when no venues', () => {
    render(<VenueListClient venues={[]} />)
    expect(screen.getByText(/no venues/i)).toBeInTheDocument()
  })
})
