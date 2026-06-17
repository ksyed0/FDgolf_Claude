import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PausedBanner } from '@/components/leaderboard/paused-banner'

describe('PausedBanner', () => {
  it('renders "Tournament paused" (AC-0226)', () => {
    render(<PausedBanner />)
    expect(screen.getByText(/tournament paused/i)).toBeInTheDocument()
  })
})
