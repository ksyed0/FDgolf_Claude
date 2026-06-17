import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HoleProgressPill } from '@/components/round/hole-progress-pill'

describe('HoleProgressPill', () => {
  it('shows "Hole X of 18" from completed count + 1 (AC-0175)', () => {
    render(<HoleProgressPill completedCount={7} />)
    expect(screen.getByText('Hole 8 of 18')).toBeInTheDocument()
  })

  it('shows "Hole 1 of 18" at the start of the round', () => {
    render(<HoleProgressPill completedCount={0} />)
    expect(screen.getByText('Hole 1 of 18')).toBeInTheDocument()
  })
})
