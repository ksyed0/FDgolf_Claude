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
  return (
    <div data-testid="tv-stats-rotator" className="h-full relative overflow-hidden">
      <div className="transition-opacity duration-[400ms] opacity-100 h-full">
        {activePanel === 0 && <TvBirdiesPanel birdies={birdies} momentum={momentum} />}
        {activePanel === 1 && <TvHoleMapPanel holes={holes} bestAchievement={bestAchievement} />}
        {activePanel === 2 && <TvShotStatsPanel stats={stats} />}
      </div>
    </div>
  )
}
