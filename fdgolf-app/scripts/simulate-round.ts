import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { LIONHEAD_HOLES } from '../e2e/fixtures/lionhead-holes'
import { getClubIds } from '../e2e/helpers/seed'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const TOURNAMENT_SLUG = process.env.SIMULATE_TOURNAMENT_SLUG ?? 'cibc-lionhead-2026'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function getTournamentId(): Promise<string> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('id')
    .eq('slug', TOURNAMENT_SLUG)
    .single()
  if (error || !data) throw new Error(`Tournament not found: ${TOURNAMENT_SLUG}`)
  return data.id
}

type Outcome = 'in_play' | 'oob' | 'sunk' | 'mulligan'

interface ShotSpec {
  outcome: Outcome
  strokeCount: number
  waypointIdx: number
  rehitFromIdx?: number
  rehitOrigin?: 'tee' | 'fairway'
  isMulligan?: boolean
}

/** Profile A (12 hdcp) explicit per-hole shot sequences */
const PROFILE_A: ShotSpec[][] = [
  // H1 par4 → 4 strokes (par)
  [
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 0 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 1 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 2 },
    { outcome: 'sunk', strokeCount: 1, waypointIdx: 3 },
  ],
  // H2 par5 → 5 strokes (par)
  [
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 0 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 1 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 2 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 2 },
    { outcome: 'sunk', strokeCount: 1, waypointIdx: 3 },
  ],
  // H3 par3 → OOB + rehit + sunk = 4 (bogey)
  [
    { outcome: 'oob', strokeCount: 1, waypointIdx: 0 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 1, rehitFromIdx: 0, rehitOrigin: 'tee' },
    { outcome: 'sunk', strokeCount: 1, waypointIdx: 3 },
  ],
  // H4 par4 → 5 strokes (bogey)
  [
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 0 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 1 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 2 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 2 },
    { outcome: 'sunk', strokeCount: 1, waypointIdx: 3 },
  ],
  // H5 par5 → 4 strokes (birdie)
  [
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 0 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 1 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 2 },
    { outcome: 'sunk', strokeCount: 1, waypointIdx: 3 },
  ],
  // H6 par4 → 5 strokes (bogey)
  [
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 0 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 1 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 2 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 2 },
    { outcome: 'sunk', strokeCount: 1, waypointIdx: 3 },
  ],
  // H7 par3 → 3 strokes (par)
  [
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 0 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 2 },
    { outcome: 'sunk', strokeCount: 1, waypointIdx: 3 },
  ],
  // H8 par4 → OOB + rehit + 4 more = 6 (double bogey)
  [
    { outcome: 'oob', strokeCount: 1, waypointIdx: 0 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 0, rehitFromIdx: 0, rehitOrigin: 'tee' },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 1 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 2 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 2 },
    { outcome: 'sunk', strokeCount: 1, waypointIdx: 3 },
  ],
  // H9 par4 → 3 strokes (birdie)
  [
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 0 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 1 },
    { outcome: 'sunk', strokeCount: 1, waypointIdx: 3 },
  ],
  // H10 par4 → 4 strokes (par)
  [
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 0 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 1 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 2 },
    { outcome: 'sunk', strokeCount: 1, waypointIdx: 3 },
  ],
  // H11 par5 → mulligan + 4 more = 5 (par with mulligan)
  [
    { outcome: 'in_play', strokeCount: 0, waypointIdx: 0, isMulligan: true },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 0, rehitFromIdx: 0, rehitOrigin: 'tee' },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 1 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 2 },
    { outcome: 'sunk', strokeCount: 1, waypointIdx: 3 },
  ],
  // H12 par3 → 4 strokes (bogey, 3-putt chip)
  [
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 0 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 2 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 3 },
    { outcome: 'sunk', strokeCount: 1, waypointIdx: 3 },
  ],
  // H13 par4 → 4 strokes (par)
  [
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 0 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 1 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 2 },
    { outcome: 'sunk', strokeCount: 1, waypointIdx: 3 },
  ],
  // H14 par4 → OOB + 5 more = 6 (double bogey)
  [
    { outcome: 'oob', strokeCount: 1, waypointIdx: 0 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 0, rehitFromIdx: 0, rehitOrigin: 'tee' },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 1 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 2 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 2 },
    { outcome: 'sunk', strokeCount: 1, waypointIdx: 3 },
  ],
  // H15 par5 → 5 strokes (par)
  [
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 0 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 1 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 2 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 2 },
    { outcome: 'sunk', strokeCount: 1, waypointIdx: 3 },
  ],
  // H16 par4 → 4 strokes (par)
  [
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 0 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 1 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 2 },
    { outcome: 'sunk', strokeCount: 1, waypointIdx: 3 },
  ],
  // H17 par3 → 3 strokes (par)
  [
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 0 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 2 },
    { outcome: 'sunk', strokeCount: 1, waypointIdx: 3 },
  ],
  // H18 par4 → 5 strokes (bogey)
  [
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 0 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 1 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 2 },
    { outcome: 'in_play', strokeCount: 1, waypointIdx: 2 },
    { outcome: 'sunk', strokeCount: 1, waypointIdx: 3 },
  ],
]

/** Generate simplified shots for profiles B/C/D given a target stroke count. */
function simpleShots(targetStrokes: number, holePar: number, waypointCount = 4): ShotSpec[] {
  void holePar
  const shots: ShotSpec[] = []
  for (let i = 0; i < targetStrokes - 1; i++) {
    shots.push({ outcome: 'in_play', strokeCount: 1, waypointIdx: Math.min(i, waypointCount - 2) })
  }
  shots.push({ outcome: 'sunk', strokeCount: 1, waypointIdx: waypointCount - 1 })
  return shots
}

/** Per-hole stroke counts for each player slot (0=ProfileA, 1=B, 2=C, 3=D) */
const HOLE_SCORES: number[][] = [
  // [A,  B,  C,  D]  vs par
  [4, 5, 6, 7], // H1  par4 — A=par, B=bogey, C=double, D=triple
  [5, 6, 7, 8], // H2  par5 — A=par, B=bogey, C=double, D=triple
  [4, 5, 6, 7], // H3  par3 — A=bogey, B=double, C=triple, D=quad
  [5, 6, 7, 8], // H4  par4 — A=bogey, B=double, C=triple, D=quad
  [4, 6, 7, 8], // H5  par5 — A=birdie, B=bogey, C=double, D=triple
  [5, 6, 7, 8], // H6  par4 — A=bogey, B=double, C=triple, D=quad
  [3, 4, 5, 6], // H7  par3 — A=par, B=bogey, C=double, D=triple
  [6, 7, 8, 9], // H8  par4 — A=double, B=triple, C=quad, D=+5
  [3, 5, 6, 7], // H9  par4 — A=birdie, B=bogey, C=double, D=triple
  [4, 5, 6, 7], // H10 par4 — A=par, B=bogey, C=double, D=triple
  [5, 7, 8, 9], // H11 par5 — A=par, B=double, C=triple, D=quad
  [4, 5, 6, 7], // H12 par3 — A=bogey, B=double, C=triple, D=quad
  [4, 5, 6, 7], // H13 par4 — A=par, B=bogey, C=double, D=triple
  [6, 7, 8, 9], // H14 par4 — A=double, B=triple, C=quad, D=+5
  [5, 6, 7, 8], // H15 par5 — A=par, B=bogey, C=double, D=triple
  [4, 5, 6, 7], // H16 par4 — A=par, B=bogey, C=double, D=triple
  [3, 4, 5, 6], // H17 par3 — A=par, B=bogey, C=double, D=triple
  [5, 6, 7, 8], // H18 par4 — A=bogey, B=double, C=triple, D=quad
]

interface PlayerRow {
  id: string
  email: string
  team_id: string
  slot: number
}

async function loadPlayers(tournamentId: string): Promise<PlayerRow[]> {
  const { data: tm } = await supabase
    .from('team_members')
    .select('player_id, team_id, players(email), teams!inner(tournament_id)')
    .eq('teams.tournament_id', tournamentId)

  const byTeam: Record<string, PlayerRow[]> = {}
  for (const row of tm ?? []) {
    const p = row as unknown as { player_id: string; team_id: string; players: { email: string } }
    byTeam[p.team_id] ??= []
    byTeam[p.team_id].push({ id: p.player_id, email: p.players.email, team_id: p.team_id, slot: 0 })
  }
  const result: PlayerRow[] = []
  for (const teamPlayers of Object.values(byTeam)) {
    teamPlayers.forEach((p, i) => {
      p.slot = i
    })
    result.push(...teamPlayers)
  }
  return result
}

async function getTeamStartHole(teamId: string): Promise<number> {
  const { data } = await supabase.from('teams').select('start_hole').eq('id', teamId).single()
  return data?.start_hole ?? 1
}

async function insertShots(
  roundId: string,
  holeNumber: number,
  specs: ShotSpec[],
  clubId: string,
  hole: (typeof LIONHEAD_HOLES)[0]
): Promise<void> {
  const insertedIds: string[] = []

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i]
    const wp = hole.waypoints[Math.min(spec.waypointIdx, hole.waypoints.length - 1)]

    let rehitFromShotId: string | null = null
    if (spec.rehitFromIdx !== undefined) rehitFromShotId = insertedIds[spec.rehitFromIdx] ?? null

    const { data } = await supabase
      .from('shots')
      .insert({
        round_id: roundId,
        hole_number: holeNumber,
        shot_number: i + 1,
        club_id: clubId,
        origin_lat: wp.lat,
        origin_lng: wp.lng,
        outcome: spec.outcome,
        stroke_count: spec.strokeCount,
        rehit_from_shot_id: rehitFromShotId,
        rehit_origin: spec.rehitOrigin ?? null,
      })
      .select('id')
      .single()

    insertedIds.push(data?.id ?? '')
  }
}

async function main() {
  const tournamentId = await getTournamentId()
  console.log(`Tournament: ${TOURNAMENT_SLUG} (${tournamentId})`)

  console.log('Loading clubs…')
  const clubs = await getClubIds([
    'Driver',
    '3 Wood',
    '5 Iron',
    '7 Iron',
    '9 Iron',
    'PW',
    'SW',
    'Putter',
  ])
  const driverId = clubs['Driver'] ?? Object.values(clubs)[0]
  const bagClubs = Object.values(clubs)

  console.log('Loading players…')
  const players = await loadPlayers(tournamentId)
  if (!players.length) {
    console.error('No players found — run npm run seed:lionhead first.')
    process.exit(1)
  }

  const teamScores: Record<string, number[]> = {}

  for (const player of players) {
    const startHole = await getTeamStartHole(player.team_id)

    const { data: round } = await supabase
      .from('rounds')
      .insert({
        tournament_id: tournamentId,
        player_id: player.id,
        team_id: player.team_id,
        start_hole: startHole,
        status: 'completed',
        bag_clubs: bagClubs,
        first_player_id: player.id,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (!round) continue
    const roundId = round.id

    const playerHoleScores: number[] = []

    for (let h = 0; h < 18; h++) {
      const hole = LIONHEAD_HOLES[h]
      const specs =
        player.slot === 0 ? PROFILE_A[h] : simpleShots(HOLE_SCORES[h][player.slot], hole.par)
      await insertShots(roundId, hole.number, specs, driverId, hole)

      const strokes = specs.reduce((sum, s) => sum + s.strokeCount, 0)
      playerHoleScores.push(strokes)
    }

    teamScores[player.team_id] ??= new Array(18).fill(999)
    playerHoleScores.forEach((s, i) => {
      teamScores[player.team_id][i] = Math.min(teamScores[player.team_id][i], s)
    })

    console.log(`  ✓ ${player.email} — ${playerHoleScores.reduce((a, b) => a + b, 0)} strokes`)
  }

  // Print standings
  const pars = LIONHEAD_HOLES.map((h) => h.par)
  const parTotal = pars.reduce((a, b) => a + b, 0)

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .eq('tournament_id', tournamentId)

  console.log('\nScoring simulation complete.\n')
  console.log('Team                 │ Front 9 │ Back 9 │ Total │ Score')
  console.log('─────────────────────┼─────────┼────────┼───────┼───────')

  const rows = (teams ?? [])
    .map((t) => {
      const scores = teamScores[t.id] ?? new Array(18).fill(0)
      const total = scores.reduce((a, b) => a + b, 0)
      const front =
        scores.slice(0, 9).reduce((a, b) => a + b, 0) - pars.slice(0, 9).reduce((a, b) => a + b, 0)
      const back =
        scores.slice(9).reduce((a, b) => a + b, 0) - pars.slice(9).reduce((a, b) => a + b, 0)
      return { name: t.name, front, back, total: total - parTotal, score: total }
    })
    .sort((a, b) => a.total - b.total)

  for (const r of rows) {
    const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`).padStart(4)
    console.log(
      `${r.name.padEnd(20)} │  ${fmt(r.front)}   │  ${fmt(r.back)}  │ ${fmt(r.total)}  │  ${r.score}`
    )
  }

  console.log(`\nLeaderboard: http://localhost:3000/t/cibc-lionhead-2026/leaderboard`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
