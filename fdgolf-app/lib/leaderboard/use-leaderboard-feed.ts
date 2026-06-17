'use client'
import { useCallback, useEffect, useState } from 'react'
import type { TeamStanding, FeedStatus } from '@/lib/leaderboard/types'

export interface FeedOptions {
  refetch?: (slug: string) => Promise<TeamStanding[]>
  enableRealtime?: boolean
  pollMs?: number
}

export interface FeedResult {
  standings: TeamStanding[]
  status: FeedStatus
  lastSync: number | null
}

export function useLeaderboardFeed(
  slug: string,
  initial: TeamStanding[],
  isPaused: boolean,
  options: FeedOptions = {}
): FeedResult {
  const pollMs = options.pollMs ?? 30_000
  const refetchFn = options.refetch
  const [standings, setStandings] = useState<TeamStanding[]>(initial)
  const [status, setStatus] = useState<FeedStatus>(isPaused ? 'paused' : 'auto')
  const [lastSync, setLastSync] = useState<number | null>(null)

  const doRefetch = useCallback(async () => {
    if (!refetchFn) return
    const next = await refetchFn(slug)
    setStandings(next)
    setLastSync(Date.now())
  }, [refetchFn, slug])

  // Polling baseline (always on unless paused).
  useEffect(() => {
    if (isPaused) {
      setStatus('paused')
      return
    }
    setStatus('auto')
    const id = setInterval(() => {
      void doRefetch()
    }, pollMs)
    return () => clearInterval(id)
  }, [isPaused, pollMs, doRefetch])

  return { standings, status, lastSync }
}
