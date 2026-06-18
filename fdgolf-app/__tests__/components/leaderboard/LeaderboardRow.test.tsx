import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LeaderboardRow } from '@/components/leaderboard/LeaderboardRow'
import type { LeaderboardRow as LeaderboardRowType } from '@/lib/leaderboard'

function renderRow(row: LeaderboardRowType) {
  return render(
    <table>
      <tbody>
        <LeaderboardRow row={row} />
      </tbody>
    </table>
  )
}

describe('LeaderboardRow', () => {
  it('under par: displays negative score with text-red-500', () => {
    renderRow({
      teamId: 'a',
      teamName: 'Eagles',
      totalVsPar: -3,
      thru: 18,
      hasProvisional: false,
      rank: 1,
    })
    const scoreEl = screen.getByTestId('score')
    expect(scoreEl.textContent).toBe('-3')
    expect(scoreEl.className).toMatch(/text-red-500/)
  })

  it('even par: displays "E" with text-slate-900', () => {
    renderRow({
      teamId: 'b',
      teamName: 'Hawks',
      totalVsPar: 0,
      thru: 9,
      hasProvisional: false,
      rank: 2,
    })
    const scoreEl = screen.getByTestId('score')
    expect(scoreEl.textContent).toBe('E')
    expect(scoreEl.className).toMatch(/text-slate-900/)
  })

  it('over par: displays positive score with text-slate-500', () => {
    renderRow({
      teamId: 'c',
      teamName: 'Falcons',
      totalVsPar: 2,
      thru: 6,
      hasProvisional: false,
      rank: 3,
    })
    const scoreEl = screen.getByTestId('score')
    expect(scoreEl.textContent).toBe('+2')
    expect(scoreEl.className).toMatch(/text-slate-500/)
  })

  it('renders thru count', () => {
    renderRow({
      teamId: 'a',
      teamName: 'Eagles',
      totalVsPar: -3,
      thru: 14,
      hasProvisional: false,
      rank: 1,
    })
    expect(screen.getByTestId('thru').textContent).toMatch(/14/)
  })

  it('renders rank', () => {
    renderRow({
      teamId: 'a',
      teamName: 'Eagles',
      totalVsPar: -3,
      thru: 18,
      hasProvisional: false,
      rank: 1,
    })
    expect(screen.getByTestId('rank').textContent).toBe('1')
  })

  it('renders team name', () => {
    renderRow({
      teamId: 'a',
      teamName: 'Eagles',
      totalVsPar: -3,
      thru: 18,
      hasProvisional: false,
      rank: 1,
    })
    expect(screen.getByTestId('team-name').textContent).toBe('Eagles')
  })
})
