'use client'

import type { HoleDifficulty, BestAchievement } from '@/lib/tv-stats'

type Props = {
  holes: HoleDifficulty[]
  bestAchievement: BestAchievement
}

function holeCircleClass(avgVsPar: number | null, teamsPlayed: number): string {
  if (avgVsPar === null || teamsPlayed === 0) return 'bg-slate-700'
  if (avgVsPar < -0.5) return 'bg-green-500'
  if (avgVsPar > 0.5) return 'bg-red-500'
  return 'bg-yellow-400'
}

function achievementLabel(vsPar: number): string {
  return vsPar <= -2 ? '🦅 EAGLE ALERT' : '🐦 BIRDIE'
}

export function TvHoleMapPanel({ holes, bestAchievement }: Props) {
  const frontNine = holes.filter((h) => h.holeNumber <= 9)
  const backNine = holes.filter((h) => h.holeNumber >= 10)

  return (
    <div data-testid="tv-hole-map-panel" className="p-8 h-full">
      <p className="text-slate-400 uppercase tracking-widest text-sm mb-6">Hole Difficulty Map</p>

      {/* Front nine */}
      <div className="flex gap-4 mb-4">
        {frontNine.map((hole) => (
          <div key={hole.holeNumber} className="flex flex-col items-center">
            <div
              data-testid={`hole-circle-${hole.holeNumber}`}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${holeCircleClass(hole.avgVsPar, hole.teamsPlayed)}`}
            >
              {hole.holeNumber}
            </div>
            <span className="text-slate-400 text-xs text-center mt-1">{hole.holeNumber}</span>
          </div>
        ))}
      </div>

      {/* Back nine */}
      <div className="flex gap-4 mb-8">
        {backNine.map((hole) => (
          <div key={hole.holeNumber} className="flex flex-col items-center">
            <div
              data-testid={`hole-circle-${hole.holeNumber}`}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${holeCircleClass(hole.avgVsPar, hole.teamsPlayed)}`}
            >
              {hole.holeNumber}
            </div>
            <span className="text-slate-400 text-xs text-center mt-1">{hole.holeNumber}</span>
          </div>
        ))}
      </div>

      {/* Best achievement callout */}
      {bestAchievement !== null && (
        <div data-testid="best-achievement" className="text-center">
          <p className="text-4xl font-bold text-white">{achievementLabel(bestAchievement.vsPar)}</p>
          <p className="text-slate-400 text-lg mt-1">
            Hole #{bestAchievement.holeNumber} · {bestAchievement.teamName}
          </p>
        </div>
      )}
    </div>
  )
}
