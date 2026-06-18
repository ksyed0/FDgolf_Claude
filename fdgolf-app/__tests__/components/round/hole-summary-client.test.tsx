import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

import { HoleSummaryClient } from '@/components/round/hole-summary-client'

beforeEach(() => vi.clearAllMocks())

describe('HoleSummaryClient', () => {
  it('shows Continue and navigates to next hole when completedCount < 18 (US-0043)', () => {
    render(
      <HoleSummaryClient roundId="r1" holeNumber={5} completedCount={5}>
        <span>summary content</span>
      </HoleSummaryClient>
    )
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(mockPush).toHaveBeenCalledWith('/round/r1/hole/6')
  })

  it('shows View Final Score and navigates to /complete when completedCount >= 18 (US-0046)', () => {
    render(
      <HoleSummaryClient roundId="r1" holeNumber={18} completedCount={18}>
        <span>summary content</span>
      </HoleSummaryClient>
    )
    expect(screen.getByRole('button', { name: /view final score/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /view final score/i }))
    expect(mockPush).toHaveBeenCalledWith('/round/r1/complete')
  })

  it('renders children inside the wrapper', () => {
    render(
      <HoleSummaryClient roundId="r1" holeNumber={3} completedCount={3}>
        <span data-testid="child">hole data</span>
      </HoleSummaryClient>
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })
})
