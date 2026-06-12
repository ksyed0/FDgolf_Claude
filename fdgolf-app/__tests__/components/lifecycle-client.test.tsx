import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import React from 'react'

const mockTransitionAction = vi.hoisted(() => vi.fn())
const mockRouterRefresh = vi.hoisted(() => vi.fn())

vi.mock('@/lib/actions/tournament-lifecycle', () => ({
  transitionTournamentAction: mockTransitionAction,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}))

import { LifecycleClient } from '@/app/admin/tournaments/[slug]/lifecycle-client'
import type { PreflightResult } from '@/lib/actions/tournament-lifecycle'

const BASE_TOURNAMENT = {
  id: 't-1',
  name: 'Spring Open 2026',
  slug: 'spring-open',
  status: 'draft',
  venues: { name: 'Granite Ridge GC' },
  courses: { name: 'Main Course' },
  starts_at: '2026-07-01T10:00:00Z',
  format: 'best_ball',
  start_style: 'shotgun',
}

const ALL_PASS_RESULT: PreflightResult = {
  allBlockingPassed: true,
  checks: [
    { key: 'name_date', label: 'Name & date set', passed: true, advisory: false },
    { key: 'venue_linked', label: 'Venue linked', passed: true, advisory: false },
    { key: 'course_linked', label: 'Course linked', passed: true, advisory: false },
    { key: 'slug_unique', label: 'Slug unique', passed: true, advisory: false },
    { key: 'organizer', label: 'Organizer assigned', passed: false, advisory: true },
  ],
}

const BLOCKED_RESULT: PreflightResult = {
  allBlockingPassed: false,
  checks: [
    { key: 'name_date', label: 'Name & date set', passed: true, advisory: false },
    { key: 'venue_linked', label: 'Venue linked', passed: false, advisory: false },
    { key: 'course_linked', label: 'Course linked', passed: false, advisory: false },
    { key: 'slug_unique', label: 'Slug unique', passed: true, advisory: false },
    { key: 'organizer', label: 'Organizer assigned', passed: false, advisory: true },
  ],
}

beforeEach(() => {
  vi.resetAllMocks()
  mockTransitionAction.mockResolvedValue({ error: null })
})

describe('LifecycleClient — draft status', () => {
  it('renders "Open Registration" button', () => {
    render(
      <LifecycleClient
        tournament={BASE_TOURNAMENT}
        preflightResult={ALL_PASS_RESULT}
        nextStatus="registration_open"
      />
    )
    expect(screen.getByRole('button', { name: /open registration/i })).toBeInTheDocument()
  })

  it('button is disabled when blocking checks fail', () => {
    render(
      <LifecycleClient
        tournament={BASE_TOURNAMENT}
        preflightResult={BLOCKED_RESULT}
        nextStatus="registration_open"
      />
    )
    expect(screen.getByRole('button', { name: /open registration/i })).toBeDisabled()
  })

  it('button is enabled when all blocking checks pass', () => {
    render(
      <LifecycleClient
        tournament={BASE_TOURNAMENT}
        preflightResult={ALL_PASS_RESULT}
        nextStatus="registration_open"
      />
    )
    expect(screen.getByRole('button', { name: /open registration/i })).not.toBeDisabled()
  })

  it('renders ✓ for passed blocking check', () => {
    render(
      <LifecycleClient
        tournament={BASE_TOURNAMENT}
        preflightResult={ALL_PASS_RESULT}
        nextStatus="registration_open"
      />
    )
    expect(screen.getByText('Name & date set')).toBeInTheDocument()
    expect(screen.getAllByText('✓').length).toBeGreaterThan(0)
  })

  it('renders ✗ for failed blocking check', () => {
    render(
      <LifecycleClient
        tournament={BASE_TOURNAMENT}
        preflightResult={BLOCKED_RESULT}
        nextStatus="registration_open"
      />
    )
    expect(screen.getAllByText('✗').length).toBeGreaterThan(0)
  })

  it('renders ⚠ for advisory check regardless of passed value', () => {
    render(
      <LifecycleClient
        tournament={BASE_TOURNAMENT}
        preflightResult={ALL_PASS_RESULT}
        nextStatus="registration_open"
      />
    )
    expect(screen.getByText('⚠')).toBeInTheDocument()
  })

  it('shows live preview card when all blocking checks pass', () => {
    render(
      <LifecycleClient
        tournament={BASE_TOURNAMENT}
        preflightResult={ALL_PASS_RESULT}
        nextStatus="registration_open"
      />
    )
    expect(screen.getByText(/public preview/i)).toBeInTheDocument()
    expect(screen.getByText('Spring Open 2026')).toBeInTheDocument()
  })

  it('hides live preview card when blocking checks fail', () => {
    render(
      <LifecycleClient
        tournament={BASE_TOURNAMENT}
        preflightResult={BLOCKED_RESULT}
        nextStatus="registration_open"
      />
    )
    expect(screen.queryByText(/public preview/i)).not.toBeInTheDocument()
  })

  it('calls transitionTournamentAction on button click', async () => {
    render(
      <LifecycleClient
        tournament={BASE_TOURNAMENT}
        preflightResult={ALL_PASS_RESULT}
        nextStatus="registration_open"
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /open registration/i }))
    })
    expect(mockTransitionAction).toHaveBeenCalledWith('t-1', 'registration_open')
  })

  it('calls router.refresh() on success', async () => {
    render(
      <LifecycleClient
        tournament={BASE_TOURNAMENT}
        preflightResult={ALL_PASS_RESULT}
        nextStatus="registration_open"
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /open registration/i }))
    })
    expect(mockRouterRefresh).toHaveBeenCalled()
  })

  it('shows error message when action returns error', async () => {
    mockTransitionAction.mockResolvedValue({ error: 'Pre-flight checks failed: Venue linked.' })
    render(
      <LifecycleClient
        tournament={BASE_TOURNAMENT}
        preflightResult={ALL_PASS_RESULT}
        nextStatus="registration_open"
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /open registration/i }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent(/Venue linked/)
  })
})

describe('LifecycleClient — registration_open status', () => {
  it('renders "Start Tournament" button', () => {
    render(
      <LifecycleClient
        tournament={{ ...BASE_TOURNAMENT, status: 'registration_open' }}
        preflightResult={ALL_PASS_RESULT}
        nextStatus="active"
      />
    )
    expect(screen.getByRole('button', { name: /start tournament/i })).toBeInTheDocument()
  })
})

describe('registration_open status', () => {
  it('shows registration URL banner', () => {
    render(
      <LifecycleClient
        tournament={{ ...BASE_TOURNAMENT, status: 'registration_open' }}
        preflightResult={null}
        nextStatus="active"
      />
    )
    expect(screen.getByText(/registration is open/i)).toBeInTheDocument()
    expect(screen.getByText(/fdgolf\.app\/register\/spring-open/i)).toBeInTheDocument()
  })

  it('copy button writes URL to clipboard', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    render(
      <LifecycleClient
        tournament={{ ...BASE_TOURNAMENT, status: 'registration_open' }}
        preflightResult={null}
        nextStatus="active"
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /copy/i }))
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'https://fdgolf.app/register/spring-open'
      )
    })
  })

  it('still shows preflight checklist and transition button below the URL banner', () => {
    render(
      <LifecycleClient
        tournament={{ ...BASE_TOURNAMENT, status: 'registration_open' }}
        preflightResult={ALL_PASS_RESULT}
        nextStatus="active"
      />
    )
    expect(screen.getByText(/fdgolf\.app\/register\/spring-open/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start tournament/i })).toBeInTheDocument()
  })
})

describe('LifecycleClient — active status', () => {
  it('renders "Complete Tournament" button with no preflight', () => {
    render(
      <LifecycleClient
        tournament={{ ...BASE_TOURNAMENT, status: 'active' }}
        preflightResult={null}
        nextStatus="completed"
      />
    )
    expect(screen.getByRole('button', { name: /complete tournament/i })).toBeInTheDocument()
  })
})

describe('LifecycleClient — completed status', () => {
  it('renders completion banner with no button', () => {
    render(
      <LifecycleClient
        tournament={{ ...BASE_TOURNAMENT, status: 'completed' }}
        preflightResult={null}
        nextStatus={null}
      />
    )
    expect(screen.getByText(/tournament complete/i)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
