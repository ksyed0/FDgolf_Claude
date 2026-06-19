import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditShotPanel } from '@/components/round/edit-shot-panel'

vi.mock('@/lib/actions/shots', () => ({
  editShotAction: vi.fn(),
  createShotAction: vi.fn(),
}))

import { editShotAction } from '@/lib/actions/shots'
const mockEditShotAction = vi.mocked(editShotAction)

const CLUBS = [
  { id: 'c1', display_name: 'Driver' },
  { id: 'c2', display_name: '7 Iron' },
]

const BASE_PROPS = {
  shotId: 'shot1',
  initialClubId: 'c1',
  initialOutcome: 'in_play' as const,
  clubs: CLUBS,
  onSave: vi.fn(),
  onCancel: vi.fn(),
}

beforeEach(() => vi.clearAllMocks())

describe('EditShotPanel', () => {
  it('renders with initial club and outcome selected', () => {
    render(<EditShotPanel {...BASE_PROPS} />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('c1')
    expect(screen.getByText('Driver')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /in play/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^sunk/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mulligan/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /oob/i })).toBeInTheDocument()
  })

  it('Save calls editShotAction with correct params and triggers onSave', async () => {
    mockEditShotAction.mockResolvedValue({ ok: true, serverId: 's1' })
    render(<EditShotPanel {...BASE_PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() =>
      expect(BASE_PROPS.onSave).toHaveBeenCalledWith(
        expect.objectContaining({ clubId: 'c1', outcome: 'in_play', strokeCount: 1 })
      )
    )
    expect(mockEditShotAction).toHaveBeenCalledWith({
      shotId: 'shot1',
      clubId: 'c1',
      outcome: 'in_play',
      strokeCount: 1,
      originLat: null,
      originLng: null,
    })
  })

  it('shows error on failed save', async () => {
    mockEditShotAction.mockResolvedValue({ ok: false, code: 'network' })
    render(<EditShotPanel {...BASE_PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(screen.getByText(/save failed/i)).toBeInTheDocument())
    expect(BASE_PROPS.onSave).not.toHaveBeenCalled()
  })

  it('Cancel calls onCancel', () => {
    render(<EditShotPanel {...BASE_PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(BASE_PROPS.onCancel).toHaveBeenCalled()
  })

  it('changes outcome to mulligan and saves with strokeCount 0', async () => {
    const onSave = vi.fn()
    vi.mocked(editShotAction).mockResolvedValue({ ok: true, serverId: 'shot1' })
    render(
      <EditShotPanel
        shotId="shot1"
        initialClubId="c1"
        initialOutcome="in_play"
        clubs={CLUBS}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /mulligan/i }))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() =>
      expect(editShotAction).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'mulligan', strokeCount: 0 })
      )
    )
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'mulligan', strokeCount: 0 })
    )
  })
})
