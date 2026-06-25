import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

import { KpiCards } from '@/components/admin/kpi-cards'

describe('KpiCards', () => {
  it('renders all four KPI cards with values (AC-0232/0233/0234/0235)', () => {
    render(<KpiCards playersCount={42} teamsPlaying={10} avgPaceMinutes={0} syncIssues={2} />)
    expect(screen.getByTestId('kpi-players')).toHaveTextContent('42')
    expect(screen.getByTestId('kpi-teams')).toHaveTextContent('10')
    expect(screen.getByTestId('kpi-pace')).toHaveTextContent('—')
    expect(screen.getByTestId('kpi-sync')).toHaveTextContent('2')
  })

  it('renders sync issues count', () => {
    render(<KpiCards playersCount={10} teamsPlaying={3} avgPaceMinutes={11} syncIssues={2} />)
    expect(screen.getByTestId('kpi-sync')).toHaveTextContent('2')
  })

  it('navigates to sync filter on sync card click', async () => {
    mockPush.mockClear()
    render(<KpiCards playersCount={10} teamsPlaying={3} avgPaceMinutes={11} syncIssues={2} />)
    await userEvent.click(screen.getByTestId('kpi-sync'))
    expect(mockPush).toHaveBeenCalledWith('/admin/dashboard?filter=sync_issue')
  })

  it('applies amber background when syncIssues > 0 (AC-0235)', () => {
    render(<KpiCards playersCount={0} teamsPlaying={0} avgPaceMinutes={0} syncIssues={3} />)
    expect(screen.getByTestId('kpi-sync')).toHaveClass('bg-amber-900')
  })

  it('does not apply amber background when syncIssues = 0', () => {
    render(<KpiCards playersCount={0} teamsPlaying={0} avgPaceMinutes={0} syncIssues={0} />)
    expect(screen.getByTestId('kpi-sync')).not.toHaveClass('bg-amber-900')
  })
})
