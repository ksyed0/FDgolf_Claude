'use client'

import { useRouter } from 'next/navigation'
import { nextPhysicalHole } from '@/lib/round/shotgun'

export function HoleSummaryClient({
  roundId,
  holeNumber,
  children,
}: {
  roundId: string
  holeNumber: number
  children: React.ReactNode
}) {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {children}
      <div className="p-4">
        <button
          className="w-full rounded bg-green-700 py-3 font-bold"
          onClick={() => router.push(`/round/${roundId}/hole/${nextPhysicalHole(holeNumber)}`)}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
