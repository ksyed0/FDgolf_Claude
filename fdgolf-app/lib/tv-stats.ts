import type { SupabaseClient } from '@supabase/supabase-js'
import { haversineMeters } from '@/lib/round/distance'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BirdieStat = { teamName: string; birdieCount: number }

export type MomentumHole = { holeNumber: number; vsPar: number }
export type MomentumStat = { teamId: string; teamName: string; last3: MomentumHole[] }

export type HoleDifficulty = { holeNumber: number; avgVsPar: number | null; teamsPlayed: number }

export type BestAchievement = { holeNumber: number; teamName: string; vsPar: number } | null

export type ShotStats = {
  longestDriveMeters: number | null
  longestDriveTeam: string | null
  clubOfDayName: string | null
  cleanestTeams: Array<{ teamName: string; oobCount: number }>
}

// ─── Shared fetch helper ──────────────────────────────────────────────────────

/**
 * Fetch all team_hole_scores rows for a tournament, joined with team name.
 * Returns rows with { team_id, team_name, hole_number, best_ball_score, par }.
 */
async function fetchHoleScoreRows(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<
  Array<{
    team_id: string
    team_name: string
    hole_number: number
    best_ball_score: number
    par: number
  }>
> {
  const { data } = await supabase
    .from('team_hole_scores')
    .select('team_id, team_name, hole_number, best_ball_score, par')
    .eq('tournament_id', tournamentId)

  return data ?? []
}

// ─── fetchBirdieStats ─────────────────────────────────────────────────────────

/**
 * AC-0317: Count birdies (best_ball_score - par <= -1) per team.
 * Returns sorted descending by birdieCount.
 */
export async function fetchBirdieStats(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<BirdieStat[]> {
  const rows = await fetchHoleScoreRows(supabase, tournamentId)

  const counts = new Map<string, { teamName: string; birdieCount: number }>()

  for (const row of rows) {
    const vsPar = row.best_ball_score - row.par
    if (vsPar <= -1) {
      const existing = counts.get(row.team_id)
      if (existing) {
        existing.birdieCount += 1
      } else {
        counts.set(row.team_id, { teamName: row.team_name, birdieCount: 1 })
      }
    }
  }

  return Array.from(counts.values()).sort((a, b) => b.birdieCount - a.birdieCount)
}

// ─── fetchMomentumStats ───────────────────────────────────────────────────────

/**
 * AC-0318/AC-0319: Last 3 holes played per team, with vsPar.
 * Returns all teams even if last3 is empty.
 */
export async function fetchMomentumStats(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<MomentumStat[]> {
  const rows = await fetchHoleScoreRows(supabase, tournamentId)

  const byTeam = new Map<
    string,
    { teamId: string; teamName: string; holes: Array<{ holeNumber: number; vsPar: number }> }
  >()

  for (const row of rows) {
    let team = byTeam.get(row.team_id)
    if (!team) {
      team = { teamId: row.team_id, teamName: row.team_name, holes: [] }
      byTeam.set(row.team_id, team)
    }
    team.holes.push({ holeNumber: row.hole_number, vsPar: row.best_ball_score - row.par })
  }

  return Array.from(byTeam.values()).map((team) => {
    const sorted = [...team.holes].sort((a, b) => b.holeNumber - a.holeNumber)
    const last3 = sorted.slice(0, 3).map((h) => ({ holeNumber: h.holeNumber, vsPar: h.vsPar }))
    return { teamId: team.teamId, teamName: team.teamName, last3 }
  })
}

// ─── fetchHoleDifficulty ──────────────────────────────────────────────────────

/**
 * AC-0320: Avg vsPar per hole, always returning exactly 18 entries (holes 1–18).
 * Holes with no data: { avgVsPar: null, teamsPlayed: 0 }.
 */
export async function fetchHoleDifficulty(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<HoleDifficulty[]> {
  const rows = await fetchHoleScoreRows(supabase, tournamentId)

  const byHole = new Map<number, { total: number; count: number }>()

  for (const row of rows) {
    const vsPar = row.best_ball_score - row.par
    const existing = byHole.get(row.hole_number)
    if (existing) {
      existing.total += vsPar
      existing.count += 1
    } else {
      byHole.set(row.hole_number, { total: vsPar, count: 1 })
    }
  }

  const result: HoleDifficulty[] = []
  for (let holeNumber = 1; holeNumber <= 18; holeNumber++) {
    const data = byHole.get(holeNumber)
    if (data) {
      result.push({
        holeNumber,
        avgVsPar: data.total / data.count,
        teamsPlayed: data.count,
      })
    } else {
      result.push({ holeNumber, avgVsPar: null, teamsPlayed: 0 })
    }
  }

  return result
}

// ─── fetchBestAchievement ─────────────────────────────────────────────────────

/**
 * AC-0321: Find the single row with lowest vsPar (best_ball_score - par).
 * Returns null if lowest vsPar > -1.
 */
export async function fetchBestAchievement(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<BestAchievement> {
  const rows = await fetchHoleScoreRows(supabase, tournamentId)

  let best: BestAchievement = null

  for (const row of rows) {
    const vsPar = row.best_ball_score - row.par
    if (best === null || vsPar < best.vsPar) {
      best = { holeNumber: row.hole_number, teamName: row.team_name, vsPar }
    }
  }

  if (best === null || best.vsPar > -1) return null
  return best
}

// ─── fetchShotStats ───────────────────────────────────────────────────────────

type ShotRow = {
  round_id: string
  hole_number: number
  shot_number: number
  origin_lat: number | null
  origin_lng: number | null
  club: string | null
  outcome: string | null
}

/**
 * AC-0322–AC-0325: Longest drive, club of day, cleanest teams.
 */
export async function fetchShotStats(
  supabase: SupabaseClient,
  tournamentId: string
): Promise<ShotStats> {
  // Fetch all rounds for this tournament once — reused across all stat sections
  const { data: rounds } = await supabase
    .from('rounds')
    .select('id, team_id')
    .eq('tournament_id', tournamentId)

  let longestDriveMeters: number | null = null
  let longestDriveTeam: string | null = null
  let clubOfDayName: string | null = null
  const cleanestTeams: Array<{ teamName: string; oobCount: number }> = []

  if (rounds && rounds.length > 0) {
    const roundIds = rounds.map((r: { id: string }) => r.id)
    const roundTeamMap = new Map<string, string>(
      rounds.map((r: { id: string; team_id: string }) => [r.id, r.team_id])
    )
    const teamIds = [...new Set(rounds.map((r: { team_id: string }) => r.team_id))]

    // ── Longest drive + club of day ──────────────────────────────────────────
    // Fetch only shot_number 1 and 2 for drive distance calculation (AC-0323)
    const { data: driveShots } = await supabase
      .from('shots')
      .select('round_id, hole_number, shot_number, origin_lat, origin_lng, club, outcome')
      .in('round_id', roundIds)
      .in('shot_number', [1, 2])

    if (driveShots && driveShots.length > 0) {
      const groups = new Map<string, { s1: ShotRow | null; s2: ShotRow | null }>()
      for (const shot of driveShots as ShotRow[]) {
        if (shot.origin_lat == null || shot.origin_lng == null) continue
        if (shot.shot_number !== 1 && shot.shot_number !== 2) continue
        const key = `${shot.round_id}:${shot.hole_number}`
        let group = groups.get(key)
        if (!group) {
          group = { s1: null, s2: null }
          groups.set(key, group)
        }
        if (shot.shot_number === 1) group.s1 = shot
        if (shot.shot_number === 2) group.s2 = shot
      }

      let bestDistance = 0
      let bestRoundId: string | null = null

      for (const [, group] of groups) {
        if (group.s1 && group.s2) {
          const dist = haversineMeters(
            { lat: group.s1.origin_lat!, lng: group.s1.origin_lng! },
            { lat: group.s2.origin_lat!, lng: group.s2.origin_lng! }
          )
          if (dist > bestDistance) {
            bestDistance = dist
            bestRoundId = group.s1.round_id
          }
        }
      }

      if (bestRoundId !== null && bestDistance > 0) {
        longestDriveMeters = bestDistance
        const teamId = roundTeamMap.get(bestRoundId) ?? null
        if (teamId) {
          const { data: teamData } = await supabase
            .from('teams')
            .select('name')
            .eq('id', teamId)
            .single()
          longestDriveTeam = teamData?.name ?? null
        }
      }

      // ── Club of day (AC-0322) ────────────────────────────────────────────────
      // Count non-mulligan shots by club, return the club with the highest count
      const clubCounts = new Map<string, number>()
      for (const shot of driveShots as ShotRow[]) {
        if (shot.outcome === 'mulligan') continue
        if (!shot.club) continue
        clubCounts.set(shot.club, (clubCounts.get(shot.club) ?? 0) + 1)
      }

      let topClub: string | null = null
      let topCount = 0
      for (const [club, count] of clubCounts) {
        if (count > topCount) {
          topCount = count
          topClub = club
        }
      }
      clubOfDayName = topClub
    }

    // ── Cleanest teams ────────────────────────────────────────────────────────

    // Fetch OOB shots
    const { data: oobShots } = await supabase
      .from('shots')
      .select('round_id')
      .in('round_id', roundIds)
      .eq('outcome', 'out_of_bounds')

    // Count OOB per team
    const oobCounts = new Map<string, number>()
    for (const shot of oobShots ?? []) {
      const teamId = roundTeamMap.get(shot.round_id)
      if (teamId) {
        oobCounts.set(teamId, (oobCounts.get(teamId) ?? 0) + 1)
      }
    }

    // Fetch all teams for the tournament to include teams with 0 OOB
    const { data: teamsData } = await supabase.from('teams').select('id, name').in('id', teamIds)

    for (const team of teamsData ?? []) {
      cleanestTeams.push({
        teamName: team.name,
        oobCount: oobCounts.get(team.id) ?? 0,
      })
    }

    // Sort by oobCount ASC, take top 3 (non-mutating)
    cleanestTeams.sort((a, b) => a.oobCount - b.oobCount)
    cleanestTeams.splice(0, cleanestTeams.length, ...cleanestTeams.slice(0, 3))
  }

  return {
    longestDriveMeters,
    longestDriveTeam,
    clubOfDayName,
    cleanestTeams,
  }
}
