'use client'

import type { BirdieStat, MomentumStat } from '@/lib/tv-stats'

type Props = {
  birdies: BirdieStat[]
  momentum: MomentumStat[]
}

function momentumBarClass(vsPar: number): string {
  if (vsPar < 0) return 'bg-green-500'
  if (vsPar > 0) return 'bg-red-500'
  return 'bg-slate-500'
}

export function TvBirdiesPanel({ birdies, momentum }: Props) {
  return (
    <div data-testid="tv-birdies-panel" className="flex gap-8 h-full p-8">
      {/* Left half — BIRDIE LEADERS */}
      <div className="flex-1">
        <p className="text-slate-400 uppercase tracking-widest text-sm mb-4">Birdie Leaders</p>
        {birdies.length === 0 ? (
          <p data-testid="no-birdies-msg" className="text-slate-400 text-center mt-8">
            No birdies yet — keep swinging!
          </p>
        ) : (
          <ul className="space-y-3">
            {birdies.map((b) => (
              <li key={b.teamName} className="flex items-center justify-between">
                <span className="text-4xl font-bold text-white">{b.teamName}</span>
                <span className="text-6xl font-bold text-white">{b.birdieCount}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Right half — LAST 3 HOLES */}
      <div className="flex-1">
        <p className="text-slate-400 uppercase tracking-widest text-sm mb-4">Last 3 Holes</p>
        <ul className="space-y-4">
          {momentum.map((team) => (
            <li key={team.teamId}>
              <p className="text-4xl font-bold text-white mb-1">{team.teamName}</p>
              <div>
                {team.last3.map((hole) => (
                  <span
                    key={hole.holeNumber}
                    data-testid={`momentum-bar-${team.teamId}-${hole.holeNumber}`}
                    data-vs-par={hole.vsPar}
                    className={`w-6 h-8 inline-block rounded-sm mr-1 ${momentumBarClass(hole.vsPar)}`}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
