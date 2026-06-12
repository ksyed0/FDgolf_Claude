import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import React from 'react'

const mockSaveHolesAction = vi.hoisted(() => vi.fn())
vi.mock('@/lib/actions/holes', () => ({ saveHolesAction: mockSaveHolesAction }))

vi.mock('@/lib/presets/courses', () => ({
  COURSE_PRESETS: [
    {
      id: 'granite-ridge',
      name: 'Granite Ridge GC',
      holes: [
        { number: 1, par: 4, handicap: 7, tees: [{ colour: 'Blue', yardage: 385 }] },
        { number: 2, par: 3, handicap: 17, tees: [{ colour: 'Blue', yardage: 165 }] },
      ],
    },
  ],
}))

import { HoleEditor } from '@/app/admin/venues/[venueId]/courses/[courseId]/hole-editor'

const INITIAL_HOLES = [
  {
    number: 1,
    par: 4,
    handicap: 7,
    pin_lat: 43.1,
    pin_lng: -79.1,
    tees: [{ colour: 'Blue', yardage: 385, lat: null, lng: null }],
  },
  { number: 2, par: 3, handicap: 17, pin_lat: null, pin_lng: null, tees: [] },
]

beforeEach(() => {
  vi.resetAllMocks()
  mockSaveHolesAction.mockResolvedValue({ error: null })
})

describe('HoleEditor', () => {
  it('renders a row per hole from initialHoles', () => {
    render(<HoleEditor courseId="c-1" holesCount={2} initialHoles={INITIAL_HOLES} />)
    const parInputs = screen.getAllByRole('spinbutton')
    expect(parInputs.length).toBeGreaterThanOrEqual(2)
  })

  it('shows ✓ for hole with pin_lat set', () => {
    render(<HoleEditor courseId="c-1" holesCount={2} initialHoles={INITIAL_HOLES} />)
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('shows – for hole without pin_lat', () => {
    render(<HoleEditor courseId="c-1" holesCount={2} initialHoles={INITIAL_HOLES} />)
    const dashes = screen.getAllByText('–')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  it('pre-fills tee colour from initialHoles', () => {
    render(<HoleEditor courseId="c-1" holesCount={2} initialHoles={INITIAL_HOLES} />)
    expect(screen.getByDisplayValue('Blue')).toBeInTheDocument()
    expect(screen.getByDisplayValue('385')).toBeInTheDocument()
  })

  it('renders default rows when no initialHoles', () => {
    render(<HoleEditor courseId="c-1" holesCount={9} initialHoles={[]} />)
    const rows = screen.getAllByRole('row')
    // 1 header + 9 data rows = 10
    expect(rows).toHaveLength(10)
  })

  it('calls saveHolesAction with correct shape on Save', async () => {
    render(<HoleEditor courseId="c-1" holesCount={2} initialHoles={INITIAL_HOLES} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save all holes/i }))
    })
    expect(mockSaveHolesAction).toHaveBeenCalledWith(
      'c-1',
      expect.arrayContaining([expect.objectContaining({ number: 1, par: 4 })])
    )
  })

  it('shows error when saveHolesAction returns error', async () => {
    mockSaveHolesAction.mockResolvedValue({ error: 'Hole 1: par must be 3–5.' })
    render(<HoleEditor courseId="c-1" holesCount={2} initialHoles={INITIAL_HOLES} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save all holes/i }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Hole 1: par must be 3–5.')
  })

  it('shows success message when save succeeds', async () => {
    render(<HoleEditor courseId="c-1" holesCount={2} initialHoles={INITIAL_HOLES} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save all holes/i }))
    })
    expect(screen.getByText(/holes saved/i)).toBeInTheDocument()
  })

  it('renders Import preset button', () => {
    render(<HoleEditor courseId="c-1" holesCount={2} initialHoles={INITIAL_HOLES} />)
    expect(screen.getByRole('button', { name: /import preset/i })).toBeInTheDocument()
  })

  it('shows preset options on Import preset click', () => {
    render(<HoleEditor courseId="c-1" holesCount={2} initialHoles={INITIAL_HOLES} />)
    fireEvent.click(screen.getByRole('button', { name: /import preset/i }))
    expect(screen.getByText('Granite Ridge GC')).toBeInTheDocument()
  })

  it('populates par and tee colour from preset', () => {
    render(<HoleEditor courseId="c-1" holesCount={2} initialHoles={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /import preset/i }))
    fireEvent.click(screen.getByText('Granite Ridge GC'))
    expect(screen.getAllByDisplayValue('Blue').length).toBeGreaterThan(0)
  })

  it('hides preset dropdown after selecting a preset', () => {
    render(<HoleEditor courseId="c-1" holesCount={2} initialHoles={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /import preset/i }))
    expect(screen.getByText('Granite Ridge GC')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Granite Ridge GC'))
    expect(screen.queryByText('Granite Ridge GC')).not.toBeInTheDocument()
  })

  it('updateRow: changing par input updates the row value', () => {
    render(<HoleEditor courseId="c-1" holesCount={2} initialHoles={INITIAL_HOLES} />)
    const parInputs = screen.getAllByRole('spinbutton')
    fireEvent.change(parInputs[0], { target: { value: '5' } })
    expect((parInputs[0] as HTMLInputElement).value).toBe('5')
  })

  it('updateRow: changing handicap input updates the row value', () => {
    render(<HoleEditor courseId="c-1" holesCount={2} initialHoles={INITIAL_HOLES} />)
    const parInputs = screen.getAllByRole('spinbutton')
    fireEvent.change(parInputs[1], { target: { value: '9' } })
    expect((parInputs[1] as HTMLInputElement).value).toBe('9')
  })

  it('updateTee: changing tee colour input updates the value', () => {
    render(<HoleEditor courseId="c-1" holesCount={2} initialHoles={INITIAL_HOLES} />)
    const colourInputs = screen.getAllByPlaceholderText(/e\.g\. Blue/i)
    fireEvent.change(colourInputs[0], { target: { value: 'White' } })
    expect((colourInputs[0] as HTMLInputElement).value).toBe('White')
  })

  it('updateTee: changing tee yardage input updates the value', () => {
    render(<HoleEditor courseId="c-1" holesCount={2} initialHoles={INITIAL_HOLES} />)
    const yardageInput = screen.getByDisplayValue('385')
    fireEvent.change(yardageInput, { target: { value: '400' } })
    expect((yardageInput as HTMLInputElement).value).toBe('400')
  })
})
