'use client'

import type {
  BirdieStat,
  MomentumStat,
  HoleDifficulty,
  BestAchievement,
  ShotStats,
} from '@/lib/tv-stats'
import { TvBirdiesPanel } from '@/components/tv/panels/TvBirdiesPanel'
import { TvHoleMapPanel } from '@/components/tv/panels/TvHoleMapPanel'
import { TvShotStatsPanel } from '@/components/tv/panels/TvShotStatsPanel'

type Props = {
  birdies: BirdieStat[]
  momentum: MomentumStat[]
  holes: HoleDifficulty[]
  bestAchievement: BestAchievement
  stats: ShotStats
  activePanel: 0 | 1 | 2
}

export function TvStatsRotator({
  birdies,
  momentum,
  holes,
  bestAchievement,
  stats,
  activePanel,
}: Props) {
  const panels = [
    <TvBirdiesPanel key={0} birdies={birdies} momentum={momentum} />,
    <TvHoleMapPanel key={1} holes={holes} bestAchievement={bestAchievement} />,
    <TvShotStatsPanel key={2} stats={stats} />,
  ]

  return (
    <div className="relative h-full" data-testid="tv-stats-rotator">
      {panels.map((panel, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-[400ms] ${
            activePanel === i ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {panel}
        </div>
      ))}
    </div>
  )
}
