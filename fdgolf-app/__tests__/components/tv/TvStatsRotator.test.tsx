import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TvStatsRotator } from '@/components/tv/TvStatsRotator'
import type {
  BirdieStat,
  MomentumStat,
  HoleDifficulty,
  BestAchievement,
  ShotStats,
} from '@/lib/tv-stats'

vi.mock('@/components/tv/panels/TvBirdiesPanel', () => ({
  TvBirdiesPanel: () => <div data-testid="mock-birdies-panel">Birdies</div>,
}))
vi.mock('@/components/tv/panels/TvHoleMapPanel', () => ({
  TvHoleMapPanel: () => <div data-testid="mock-hole-map-panel">HoleMap</div>,
}))
vi.mock('@/components/tv/panels/TvShotStatsPanel', () => ({
  TvShotStatsPanel: () => <div data-testid="mock-shot-stats-panel">ShotStats</div>,
}))

const DEFAULT_STATS: ShotStats = {
  longestDriveMeters: null,
  longestDriveTeam: null,
  clubOfDayName: null,
  cleanestTeams: [],
}

const EMPTY_HOLES: HoleDifficulty[] = []
const EMPTY_BIRDIES: BirdieStat[] = []
const EMPTY_MOMENTUM: MomentumStat[] = []
const NULL_ACHIEVEMENT: BestAchievement = null

function renderRotator(activePanel: 0 | 1 | 2 = 0) {
  return render(
    <TvStatsRotator
      birdies={EMPTY_BIRDIES}
      momentum={EMPTY_MOMENTUM}
      holes={EMPTY_HOLES}
      bestAchievement={NULL_ACHIEVEMENT}
      stats={DEFAULT_STATS}
      activePanel={activePanel}
    />
  )
}

describe('TvStatsRotator', () => {
  it('renders data-testid="tv-stats-rotator"', () => {
    renderRotator(0)
    expect(screen.getByTestId('tv-stats-rotator')).toBeInTheDocument()
  })

  it('shows birdies panel when activePanel=0', () => {
    renderRotator(0)
    expect(screen.getByTestId('mock-birdies-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('mock-hole-map-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mock-shot-stats-panel')).not.toBeInTheDocument()
  })

  it('shows hole map panel when activePanel=1', () => {
    renderRotator(1)
    expect(screen.getByTestId('mock-hole-map-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('mock-birdies-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mock-shot-stats-panel')).not.toBeInTheDocument()
  })

  it('shows shot stats panel when activePanel=2', () => {
    renderRotator(2)
    expect(screen.getByTestId('mock-shot-stats-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('mock-birdies-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mock-hole-map-panel')).not.toBeInTheDocument()
  })
})
