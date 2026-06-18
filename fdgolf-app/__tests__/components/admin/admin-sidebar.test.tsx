import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/dashboard' }))
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

import { AdminSidebar } from '@/components/admin/admin-sidebar'

describe('AdminSidebar', () => {
  it('renders all 8 nav items (AC-0228)', () => {
    render(<AdminSidebar />)
    const labels = [
      'Dashboard',
      'Tournaments',
      'Players',
      'Teams',
      'Scores',
      'Courses',
      'Clubs',
      'Stats',
    ]
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('highlights current route (AC-0230)', () => {
    render(<AdminSidebar />)
    const dashLink = screen.getAllByText('Dashboard')[0].closest('a')
    expect(dashLink?.className).toContain('bg-green-800')
  })

  it('renders two groups: Operational and Setup (AC-0229)', () => {
    render(<AdminSidebar />)
    expect(screen.getByText(/operational/i)).toBeInTheDocument()
    expect(screen.getByText(/setup/i)).toBeInTheDocument()
  })
})
