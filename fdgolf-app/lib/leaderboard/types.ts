export type HoleStatus = 'provisional' | 'final'
export type FeedStatus = 'auto' | 'live' | 'paused'

export interface TeamStanding {
  teamId: string
  teamName: string
  totalScore: number
  totalVsPar: number
  thru: number
  hasProvisional: boolean
  rank: number
}

export interface TeamRosterMember {
  name: string
  company: string | null
}

export interface TeamRoster {
  teamId: string
  teamName: string
  startHole: number | null
  members: TeamRosterMember[]
}

export interface HoleVsPar {
  holeNumber: number
  best: number
  par: number
  holeVsPar: number
  cumulativeVsPar: number | null
  status: HoleStatus
}

export interface CurrentTeam {
  standing: TeamStanding
  roster: TeamRoster
}

export interface TournamentHeader {
  id: string
  slug: string
  name: string
  venue: string
  startsAt: string
  status: 'draft' | 'registration_open' | 'active' | 'paused' | 'completed'
}
