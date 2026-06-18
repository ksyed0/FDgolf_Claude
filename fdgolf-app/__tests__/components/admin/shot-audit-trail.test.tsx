import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShotAuditTrail } from '@/components/admin/shot-audit-trail'

const EDITS = [
  {
    id: 'e1',
    edited_by: 'user1',
    before_state: { outcome: 'in_play' },
    after_state: { outcome: 'sunk' },
    created_at: new Date().toISOString(),
  },
]

describe('ShotAuditTrail', () => {
  it('shows empty state when no edits (AC-0255)', () => {
    render(<ShotAuditTrail edits={[]} isAdmin={false} />)
    expect(screen.getByText(/no edits recorded/i)).toBeInTheDocument()
  })

  it('renders audit rows with before/after outcomes (AC-0255)', () => {
    render(<ShotAuditTrail edits={EDITS} isAdmin={false} />)
    expect(screen.getAllByTestId('audit-row')).toHaveLength(1)
    expect(screen.getByText('sunk')).toBeInTheDocument()
    expect(screen.getByText('in_play')).toBeInTheDocument()
  })

  it('applies amber styling for admin edits (AC-0256)', () => {
    render(<ShotAuditTrail edits={EDITS} isAdmin={true} />)
    const row = screen.getByTestId('audit-row')
    expect(row.className).toContain('amber')
  })

  it('no amber styling when isAdmin is false', () => {
    render(<ShotAuditTrail edits={EDITS} isAdmin={false} />)
    const row = screen.getByTestId('audit-row')
    expect(row.className).not.toContain('amber')
  })
})
