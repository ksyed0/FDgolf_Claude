import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TvShotStatsPanel } from '@/components/tv/panels/TvShotStatsPanel'
import type { ShotStats } from '@/lib/tv-stats'

const BASE_STATS: ShotStats = {
  longestDriveMeters: null,
  longestDriveTeam: null,
  clubOfDayName: null,
  cleanestTeams: [],
}

describe('TvShotStatsPanel', () => {
  it('shows "GPS data pending" when longestDriveMeters=null (AC-0323)', () => {
    render(<TvShotStatsPanel stats={BASE_STATS} />)
    const el = screen.getByTestId('longest-drive-value')
    expect(el.textContent).toContain('GPS data pending')
  })

  it('shows "287m" when longestDriveMeters=287.4 (AC-0323)', () => {
    render(<TvShotStatsPanel stats={{ ...BASE_STATS, longestDriveMeters: 287.4 }} />)
    const el = screen.getByTestId('longest-drive-value')
    expect(el.textContent).toContain('287m')
  })

  it('shows club of day name when provided (AC-0324)', () => {
    render(<TvShotStatsPanel stats={{ ...BASE_STATS, clubOfDayName: '7-Iron' }} />)
    expect(screen.getByText('7-Iron')).toBeInTheDocument()
  })

  it('renders all-clean message when cleanestTeams[0].oobCount === 0 (AC-0325)', () => {
    const stats: ShotStats = {
      ...BASE_STATS,
      cleanestTeams: [{ teamName: 'Birdie Chasers', oobCount: 0 }],
    }
    render(<TvShotStatsPanel stats={stats} />)
    expect(screen.getByTestId('all-clean-msg')).toBeInTheDocument()
  })

  it('shows cleanest team name when oobCount > 0', () => {
    const stats: ShotStats = {
      ...BASE_STATS,
      cleanestTeams: [{ teamName: 'Birdie Chasers', oobCount: 2 }],
    }
    render(<TvShotStatsPanel stats={stats} />)
    expect(screen.queryByTestId('all-clean-msg')).not.toBeInTheDocument()
    expect(screen.getByText('Birdie Chasers')).toBeInTheDocument()
  })
})
