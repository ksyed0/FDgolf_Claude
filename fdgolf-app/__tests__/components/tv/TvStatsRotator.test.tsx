import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
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

  it('AC-0327: active panel has opacity-100, inactive panels have opacity-0 when activePanel=0', () => {
    renderRotator(0)
    const rotator = screen.getByTestId('tv-stats-rotator')
    const wrappers = rotator.querySelectorAll(':scope > div')
    expect(wrappers).toHaveLength(3)
    // Panel 0 active
    expect(wrappers[0].className).toContain('opacity-100')
    // Panels 1 and 2 inactive
    expect(wrappers[1].className).toContain('opacity-0')
    expect(wrappers[2].className).toContain('opacity-0')
  })

  it('AC-0327: active panel has opacity-100, inactive panels have opacity-0 when activePanel=1', () => {
    renderRotator(1)
    const rotator = screen.getByTestId('tv-stats-rotator')
    const wrappers = rotator.querySelectorAll(':scope > div')
    expect(wrappers[0].className).toContain('opacity-0')
    expect(wrappers[1].className).toContain('opacity-100')
    expect(wrappers[2].className).toContain('opacity-0')
  })

  it('AC-0327: active panel has opacity-100, inactive panels have opacity-0 when activePanel=2', () => {
    renderRotator(2)
    const rotator = screen.getByTestId('tv-stats-rotator')
    const wrappers = rotator.querySelectorAll(':scope > div')
    expect(wrappers[0].className).toContain('opacity-0')
    expect(wrappers[1].className).toContain('opacity-0')
    expect(wrappers[2].className).toContain('opacity-100')
  })

  it('all three panels are always rendered in the DOM', () => {
    renderRotator(0)
    expect(screen.getByTestId('mock-birdies-panel')).toBeInTheDocument()
    expect(screen.getByTestId('mock-hole-map-panel')).toBeInTheDocument()
    expect(screen.getByTestId('mock-shot-stats-panel')).toBeInTheDocument()
  })

  it('transition class is present on all panel wrappers', () => {
    renderRotator(0)
    const rotator = screen.getByTestId('tv-stats-rotator')
    const wrappers = rotator.querySelectorAll(':scope > div')
    wrappers.forEach((wrapper) => {
      expect(wrapper.className).toContain('transition-opacity')
      expect(wrapper.className).toContain('duration-[400ms]')
    })
  })
})
