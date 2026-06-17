import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TeamRosterMember } from '@/lib/leaderboard/types'

const { mockFrom, mockEq, mockOrder, mockMaybeSingle } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockEq: vi.fn(),
  mockOrder: vi.fn(),
  mockMaybeSingle: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: mockFrom }),
}))

import { getTournamentBySlug, getStandings, getRosters } from '@/lib/leaderboard/queries'

describe('leaderboard types (privacy contract)', () => {
  it('TeamRosterMember exposes only name + company', () => {
    const member: TeamRosterMember = { name: 'Pat Public', company: 'Acme' }
    expect(Object.keys(member).sort()).toEqual(['company', 'name'])
  })
})

describe('getTournamentBySlug', () => {
  beforeEach(() => vi.resetAllMocks())

  it('resolves a tournament by slug and maps to a header', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 't1',
        slug: 'cibc',
        name: 'CIBC',
        venue: 'Granite Ridge',
        starts_at: '2026-06-22T13:00:00Z',
        status: 'active',
      },
      error: null,
    })
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
    mockFrom.mockReturnValue({ select: () => ({ eq: mockEq }) })

    const t = await getTournamentBySlug('cibc')
    expect(mockFrom).toHaveBeenCalledWith('tournaments')
    expect(t).toEqual({
      id: 't1',
      slug: 'cibc',
      name: 'CIBC',
      venue: 'Granite Ridge',
      startsAt: '2026-06-22T13:00:00Z',
      status: 'active',
    })
  })

  it('returns null for an unknown slug', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
    mockFrom.mockReturnValue({ select: () => ({ eq: mockEq }) })
    expect(await getTournamentBySlug('nope')).toBeNull()
  })
})

describe('getStandings', () => {
  beforeEach(() => vi.resetAllMocks())

  it('queries team_standings filtered by tournament, mapped + ordered by rank', async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          team_id: 'a',
          team_name: 'Eagles',
          total_score: 70,
          total_vs_par: -2,
          thru: 9,
          has_provisional: true,
          rank: 1,
        },
        {
          team_id: 'b',
          team_name: 'Hawks',
          total_score: 72,
          total_vs_par: 0,
          thru: 9,
          has_provisional: false,
          rank: 2,
        },
      ],
      error: null,
    })
    mockEq.mockReturnValue({ order: mockOrder })
    mockFrom.mockReturnValue({ select: () => ({ eq: mockEq }) })

    const rows = await getStandings('t1')
    expect(mockFrom).toHaveBeenCalledWith('team_standings')
    expect(mockEq).toHaveBeenCalledWith('tournament_id', 't1')
    expect(rows[0]).toEqual({
      teamId: 'a',
      teamName: 'Eagles',
      totalScore: 70,
      totalVsPar: -2,
      thru: 9,
      hasProvisional: true,
      rank: 1,
    })
    expect(rows[1].teamName).toBe('Hawks')
  })
})

describe('getRosters (privacy)', () => {
  beforeEach(() => vi.resetAllMocks())

  it('reads public_team_roster and groups members; payload has no PII keys', async () => {
    mockEq.mockResolvedValue({
      data: [
        {
          team_id: 'a',
          team_name: 'Eagles',
          start_hole: 1,
          member_name: 'Pat',
          member_company: 'Acme',
        },
        {
          team_id: 'a',
          team_name: 'Eagles',
          start_hole: 1,
          member_name: 'Lee',
          member_company: null,
        },
        {
          team_id: 'b',
          team_name: 'Hawks',
          start_hole: 5,
          member_name: 'Sam',
          member_company: 'Globex',
        },
      ],
      error: null,
    })
    mockFrom.mockReturnValue({ select: () => ({ eq: mockEq }) })

    const rosters = await getRosters('t1')
    expect(mockFrom).toHaveBeenCalledWith('public_team_roster')
    expect(mockEq).toHaveBeenCalledWith('tournament_id', 't1')

    const eagles = rosters.find((r) => r.teamId === 'a')!
    expect(eagles.teamName).toBe('Eagles')
    expect(eagles.startHole).toBe(1)
    expect(eagles.members).toEqual([
      { name: 'Pat', company: 'Acme' },
      { name: 'Lee', company: null },
    ])
    // Privacy: serialized payload must contain no PII substrings/keys.
    const json = JSON.stringify(rosters)
    for (const k of ['email', 'phone', 'handicap', 'title', 'user_id', 'year_of_birth', 'gender']) {
      expect(json).not.toContain(k)
    }
  })
})
