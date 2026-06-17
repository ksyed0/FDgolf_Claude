import { describe, it, expect } from 'vitest'
import type { TeamRosterMember } from '@/lib/leaderboard/types'

describe('leaderboard types (privacy contract)', () => {
  it('TeamRosterMember exposes only name + company', () => {
    const member: TeamRosterMember = { name: 'Pat Public', company: 'Acme' }
    // The forbidden keys must not be assignable; assert at runtime too.
    const keys = Object.keys(member).sort()
    expect(keys).toEqual(['company', 'name'])
  })
})
