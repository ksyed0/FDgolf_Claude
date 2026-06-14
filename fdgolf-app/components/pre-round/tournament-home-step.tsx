import { CountdownCard } from './countdown-card'

interface Tournament {
  id: string
  name: string
  starts_at: string
  status: string
}
interface Team {
  id: string
  name: string
  start_hole: number
}
interface Member {
  id: string
  full_name: string
  company: string | null
}
interface StartingHole {
  number: number
  par: number
  strokeIndex: number | null
  yardage: number | null
  pinLat: number | null
  pinLng: number | null
}

interface Props {
  tournament: Tournament
  team: Team
  members: Member[]
  startingHole: StartingHole
  onNext: () => void
}

export function TournamentHomeStep({ tournament, team, members, startingHole, onNext }: Props) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-bold text-white">{tournament.name}</h1>

      <CountdownCard
        startsAt={tournament.starts_at}
        tournamentStatus={tournament.status}
        holeNumber={startingHole.number}
      />

      <div className="rounded-lg bg-slate-800 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your team</p>
        <p className="mt-1 text-sm font-bold text-white">{team.name}</p>
        <ul className="mt-1 space-y-0.5">
          {members.map((m) => (
            <li key={m.id} className="text-xs text-slate-400">
              {m.full_name}
              {m.company ? ` · ${m.company}` : ''}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg bg-slate-800 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Starting hole
        </p>
        <p className="mt-1 text-sm font-bold text-white">
          Hole {startingHole.number} — Par {startingHole.par}
          {startingHole.yardage ? `, ${startingHole.yardage} yds` : ''}
        </p>
        {startingHole.strokeIndex && (
          <p className="text-xs text-slate-500">Stroke index {startingHole.strokeIndex}</p>
        )}
      </div>

      <a
        href={`/t/${tournament.id}/leaderboard`}
        className="text-center text-xs text-blue-400 underline"
      >
        View leaderboard
      </a>

      <button onClick={onNext} className="w-full rounded-lg bg-green-700 py-3 font-bold text-white">
        Start Round →
      </button>
    </div>
  )
}
