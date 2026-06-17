'use client'
import type { FeedStatus } from '@/lib/leaderboard/types'

export function StatusPill({ status }: { status: FeedStatus }) {
  if (status === 'paused') return null
  if (status === 'live') {
    return (
      <span
        data-testid="status-pill"
        className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white animate-pulse"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-white" />
        LIVE
      </span>
    )
  }
  return (
    <span
      data-testid="status-pill"
      className="inline-flex items-center gap-1.5 rounded-full bg-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-200"
    >
      AUTO 30s
    </span>
  )
}
