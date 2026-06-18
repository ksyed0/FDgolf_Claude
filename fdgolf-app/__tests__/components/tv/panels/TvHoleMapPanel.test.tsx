import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TvHoleMapPanel } from '@/components/tv/panels/TvHoleMapPanel'
import type { HoleDifficulty, BestAchievement } from '@/lib/tv-stats'

function makeHoles(overrides: Partial<HoleDifficulty>[] = []): HoleDifficulty[] {
  return Array.from({ length: 18 }, (_, i) => {
    const holeNumber = i + 1
    const override = overrides.find((o) => o.holeNumber === holeNumber)
    return {
      holeNumber,
      avgVsPar: null,
      teamsPlayed: 0,
      ...override,
    }
  })
}

describe('TvHoleMapPanel', () => {
  it('renders 18 hole circles', () => {
    const holes = makeHoles()
    render(<TvHoleMapPanel holes={holes} bestAchievement={null} />)
    for (let i = 1; i <= 18; i++) {
      expect(screen.getByTestId(`hole-circle-${i}`)).toBeInTheDocument()
    }
  })

  it('hole-circle-3 has bg-green-500 when avgVsPar=-0.8 (AC-0320)', () => {
    const holes = makeHoles([{ holeNumber: 3, avgVsPar: -0.8, teamsPlayed: 5 }])
    render(<TvHoleMapPanel holes={holes} bestAchievement={null} />)
    const circle = screen.getByTestId('hole-circle-3')
    expect(circle.className).toContain('bg-green-500')
  })

  it('hole-circle-5 has bg-slate-700 when avgVsPar=null (AC-0320)', () => {
    const holes = makeHoles([{ holeNumber: 5, avgVsPar: null, teamsPlayed: 0 }])
    render(<TvHoleMapPanel holes={holes} bestAchievement={null} />)
    const circle = screen.getByTestId('hole-circle-5')
    expect(circle.className).toContain('bg-slate-700')
  })

  it('hole with avgVsPar=0.8 has bg-red-500', () => {
    const holes = makeHoles([{ holeNumber: 10, avgVsPar: 0.8, teamsPlayed: 3 }])
    render(<TvHoleMapPanel holes={holes} bestAchievement={null} />)
    const circle = screen.getByTestId('hole-circle-10')
    expect(circle.className).toContain('bg-red-500')
  })

  it('hole with avgVsPar=0.3 (between -0.5 and 0.5) has bg-yellow-400', () => {
    const holes = makeHoles([{ holeNumber: 7, avgVsPar: 0.3, teamsPlayed: 4 }])
    render(<TvHoleMapPanel holes={holes} bestAchievement={null} />)
    const circle = screen.getByTestId('hole-circle-7')
    expect(circle.className).toContain('bg-yellow-400')
  })

  it('renders best-achievement testid when bestAchievement is provided (AC-0321)', () => {
    const holes = makeHoles()
    const best: BestAchievement = { holeNumber: 5, teamName: 'Eagles', vsPar: -1 }
    render(<TvHoleMapPanel holes={holes} bestAchievement={best} />)
    expect(screen.getByTestId('best-achievement')).toBeInTheDocument()
  })

  it('does not render best-achievement testid when bestAchievement is null (AC-0321)', () => {
    const holes = makeHoles()
    render(<TvHoleMapPanel holes={holes} bestAchievement={null} />)
    expect(screen.queryByTestId('best-achievement')).not.toBeInTheDocument()
  })
})
