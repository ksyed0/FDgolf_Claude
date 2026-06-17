import { holesCompletedPill } from '@/lib/round/shotgun'

export function HoleProgressPill({ completedCount }: { completedCount: number }) {
  return (
    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200">
      Hole {holesCompletedPill(completedCount)} of 18
    </span>
  )
}
