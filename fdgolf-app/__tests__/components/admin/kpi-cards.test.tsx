import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KpiCards } from '@/components/admin/kpi-cards'

describe('KpiCards', () => {
  it('renders all four KPI cards with values (AC-0232/0233/0234/0235)', () => {
    render(<KpiCards playersCount={42} teamsPlaying={10} avgPaceMinutes={0} syncIssues={2} />)
    expect(screen.getByTestId('kpi-players')).toHaveTextContent('42')
    expect(screen.getByTestId('kpi-teams')).toHaveTextContent('10')
    expect(screen.getByTestId('kpi-pace')).toHaveTextContent('—')
    expect(screen.getByTestId('kpi-sync')).toHaveTextContent('2')
  })

  it('highlights sync issues card in amber when count > 0 (AC-0235)', () => {
    render(<KpiCards playersCount={0} teamsPlaying={0} avgPaceMinutes={0} syncIssues={3} />)
    expect(screen.getByTestId('kpi-sync').className).toContain('amber')
  })

  it('does not highlight sync issues card when count is 0', () => {
    render(<KpiCards playersCount={0} teamsPlaying={0} avgPaceMinutes={0} syncIssues={0} />)
    expect(screen.getByTestId('kpi-sync').className).not.toContain('amber')
  })
})
