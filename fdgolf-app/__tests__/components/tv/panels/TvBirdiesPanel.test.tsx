import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TvBirdiesPanel } from '@/components/tv/panels/TvBirdiesPanel'
import type { BirdieStat, MomentumStat } from '@/lib/tv-stats'

const BIRDIES: BirdieStat[] = [
  { teamName: 'Eagles', birdieCount: 3 },
  { teamName: 'Hawks', birdieCount: 1 },
]

const MOMENTUM: MomentumStat[] = [
  {
    teamId: 'team-1',
    teamName: 'Eagles',
    last3: [
      { holeNumber: 7, vsPar: -1 },
      { holeNumber: 8, vsPar: 0 },
      { holeNumber: 9, vsPar: 1 },
    ],
  },
]

describe('TvBirdiesPanel', () => {
  it('renders no-birdies message when birdies array is empty (AC-0318)', () => {
    render(<TvBirdiesPanel birdies={[]} momentum={[]} />)
    expect(screen.getByTestId('no-birdies-msg')).toBeInTheDocument()
  })

  it('renders birdie count when data is present', () => {
    render(<TvBirdiesPanel birdies={BIRDIES} momentum={[]} />)
    expect(screen.queryByTestId('no-birdies-msg')).not.toBeInTheDocument()
    expect(screen.getByText('Eagles')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders momentum bar with green class for vsPar < 0 (AC-0319)', () => {
    render(<TvBirdiesPanel birdies={[]} momentum={MOMENTUM} />)
    const bars = document.querySelectorAll('[data-testid^="momentum-bar-"]')
    const greenBar = Array.from(bars).find((b) => b.getAttribute('data-vs-par') === '-1')
    expect(greenBar).toBeTruthy()
    expect(greenBar?.className).toContain('bg-green-500')
  })

  it('renders momentum bar with red class for vsPar > 0 (AC-0319)', () => {
    render(<TvBirdiesPanel birdies={[]} momentum={MOMENTUM} />)
    const bars = document.querySelectorAll('[data-testid^="momentum-bar-"]')
    const redBar = Array.from(bars).find((b) => b.getAttribute('data-vs-par') === '1')
    expect(redBar).toBeTruthy()
    expect(redBar?.className).toContain('bg-red-500')
  })
})
