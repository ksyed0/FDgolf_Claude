import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PausedBanner } from '@/components/leaderboard/PausedBanner'

describe('PausedBanner', () => {
  it('renders amber banner when isPaused=true (AC-0226)', () => {
    render(<PausedBanner isPaused={true} />)
    expect(screen.getByTestId('paused-banner')).toBeInTheDocument()
    expect(screen.getByText(/tournament paused/i)).toBeInTheDocument()
  })

  it('renders nothing when isPaused=false', () => {
    const { container } = render(<PausedBanner isPaused={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('banner has amber styling (AC-0226)', () => {
    render(<PausedBanner isPaused={true} />)
    const banner = screen.getByTestId('paused-banner')
    expect(banner.className).toMatch(/amber/)
  })
})
