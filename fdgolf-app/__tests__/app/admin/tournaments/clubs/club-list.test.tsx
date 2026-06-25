import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: React.ReactNode
    onDragEnd: (e: unknown) => void
  }) => (
    <div
      data-testid="dnd-context"
      onClick={() => onDragEnd({ active: { id: 'club-1' }, over: { id: 'club-2' } })}
    >
      {children}
    </div>
  ),
  closestCenter: vi.fn(),
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: {},
  arrayMove: vi.fn((arr: unknown[], from: number, to: number) => {
    const next = [...arr]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    return next
  }),
}))

vi.mock('@/lib/actions/clubs', () => ({
  reorderClubsAction: vi.fn().mockResolvedValue({ error: null }),
  toggleClubActiveAction: vi.fn().mockResolvedValue({ error: null }),
  updateClubAction: vi.fn().mockResolvedValue({ error: null }),
  deleteClubAction: vi.fn().mockResolvedValue({ error: null }),
}))

import { ClubListClient } from '@/app/admin/tournaments/[slug]/clubs/club-list-client'

const MOCK_CLUBS = [
  {
    club_id: 'club-1',
    display_name: 'Driver',
    default_loft_degrees: 9.5,
    display_order: 0,
    is_active: true,
  },
  {
    club_id: 'club-2',
    display_name: 'Iron 7',
    default_loft_degrees: 34.0,
    display_order: 1,
    is_active: true,
  },
]

describe('ClubListClient', () => {
  it('renders club display names', () => {
    render(<ClubListClient clubs={MOCK_CLUBS} tournamentId="tour-1" />)
    expect(screen.getByDisplayValue('Driver')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Iron 7')).toBeInTheDocument()
  })

  it('calls reorderClubsAction on drag end', async () => {
    const { reorderClubsAction } = await import('@/lib/actions/clubs')
    render(<ClubListClient clubs={MOCK_CLUBS} tournamentId="tour-1" />)
    fireEvent.click(screen.getByTestId('dnd-context'))
    expect(reorderClubsAction).toHaveBeenCalled()
  })

  it('calls toggleClubActiveAction on toggle click', async () => {
    const { toggleClubActiveAction } = await import('@/lib/actions/clubs')
    render(<ClubListClient clubs={MOCK_CLUBS} tournamentId="tour-1" />)
    const toggles = screen.getAllByRole('checkbox')
    await userEvent.click(toggles[0])
    expect(toggleClubActiveAction).toHaveBeenCalledWith('club-1', 'tour-1', false)
  })

  it('calls updateClubAction on name blur', async () => {
    const { updateClubAction } = await import('@/lib/actions/clubs')
    render(<ClubListClient clubs={MOCK_CLUBS} tournamentId="tour-1" />)
    const nameInput = screen.getByDisplayValue('Driver')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Big Driver')
    fireEvent.blur(nameInput)
    expect(updateClubAction).toHaveBeenCalledWith(
      'club-1',
      expect.objectContaining({ display_name: 'Big Driver' })
    )
  })

  it('shows delete confirmation dialog', async () => {
    render(<ClubListClient clubs={MOCK_CLUBS} tournamentId="tour-1" />)
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    await userEvent.click(deleteButtons[0])
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument()
  })
})
