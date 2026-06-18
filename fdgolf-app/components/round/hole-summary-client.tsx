'use client'

import { useRouter } from 'next/navigation'
import { nextPhysicalHole } from '@/lib/round/shotgun'

export function HoleSummaryClient({
  roundId,
  holeNumber,
  completedCount,
  children,
}: {
  roundId: string
  holeNumber: number
  completedCount: number
  children: React.ReactNode
}) {
  const router = useRouter()
  const isLastHole = completedCount >= 18

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {children}
      <div className="p-4">
        <button
          className="w-full rounded bg-green-700 py-3 font-bold"
          onClick={() =>
            router.push(
              isLastHole
                ? `/round/${roundId}/complete`
                : `/round/${roundId}/hole/${nextPhysicalHole(holeNumber)}`
            )
          }
        >
          {isLastHole ? 'View Final Score' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
