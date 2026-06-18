// fdgolf-app/__tests__/components/admin/score-editor.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/lib/actions/shots', () => ({
  editShotAction: vi.fn().mockResolvedValue({ ok: true, serverId: 's1' }),
  getShotEditsAction: vi.fn().mockResolvedValue([]),
}))

import { ScoreEditor } from '@/components/admin/score-editor'
import { editShotAction } from '@/lib/actions/shots'

const SHOTS = [
  {
    id: 's1',
    hole_number: 1,
    shot_number: 1,
    outcome: 'in_play',
    stroke_count: 1,
    club_id: 'c1',
    origin_lat: 45,
    origin_lng: -75,
    clubs: { display_name: 'Driver' },
  },
]
const CLUBS = [
  { id: 'c1', display_name: 'Driver' },
  { id: 'c2', display_name: '7 Iron' },
]

beforeEach(() => vi.clearAllMocks())

describe('ScoreEditor', () => {
  it('renders shot rows grouped by hole (AC-0251)', () => {
    render(<ScoreEditor roundId="r1" shots={SHOTS} clubs={CLUBS} />)
    expect(screen.getByText(/hole 1/i)).toBeInTheDocument()
    expect(screen.getAllByTestId('shot-row')).toHaveLength(1)
  })

  it('shows edit form on Edit click (AC-0252)', () => {
    render(<ScoreEditor roundId="r1" shots={SHOTS} clubs={CLUBS} />)
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(screen.getByRole('combobox', { name: /outcome/i })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /club/i })).toBeInTheDocument()
  })

  it('calls editShotAction on Save (AC-0253)', async () => {
    render(<ScoreEditor roundId="r1" shots={SHOTS} clubs={CLUBS} />)
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() =>
      expect(editShotAction).toHaveBeenCalledWith(expect.objectContaining({ shotId: 's1' }))
    )
  })

  it('Cancel hides the edit form', () => {
    render(<ScoreEditor roundId="r1" shots={SHOTS} clubs={CLUBS} />)
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('combobox', { name: /outcome/i })).not.toBeInTheDocument()
  })
})
