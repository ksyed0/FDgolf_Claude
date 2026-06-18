'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchTeamHoleScores, type HoleScore } from '@/lib/leaderboard'

interface Props {
  teamId: string
  tournamentId: string
  onClose: () => void
}

function scoreClasses(hole: HoleScore): string {
  const classes: string[] = []

  if (hole.holeVsPar !== null && hole.holeVsPar <= -1) {
    classes.push('text-yellow-500', 'font-bold')
  }

  if (hole.status === 'provisional') {
    classes.push('italic', 'text-slate-400')
  }

  return classes.join(' ')
}

function HoleCell({ hole }: { hole: HoleScore }) {
  const hasScore = hole.bestBallScore !== null
  const scoreText = hasScore ? String(hole.bestBallScore) : '—'
  const classes = scoreClasses(hole)

  return (
    <div
      data-testid={`hole-cell-${hole.holeNumber}`}
      className="flex flex-col items-center gap-0.5"
    >
      <span className="text-xs text-slate-400">{hole.holeNumber}</span>
      <span className="text-xs text-slate-400">P{hole.par}</span>
      <span
        data-testid={`hole-score-${hole.holeNumber}`}
        className={`text-sm font-semibold ${classes}`}
      >
        {scoreText}
      </span>
    </div>
  )
}

export function TeamDrilldown({ teamId, tournamentId, onClose }: Props) {
  const [holes, setHoles] = useState<HoleScore[]>([])

  useEffect(() => {
    const supabase = createClient()
    fetchTeamHoleScores(supabase, teamId, tournamentId).then(setHoles)
  }, [teamId, tournamentId])

  const frontNine = holes.filter((h) => h.holeNumber <= 9)
  const backNine = holes.filter((h) => h.holeNumber >= 10)

  return (
    <div
      data-testid="team-drilldown"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-lg bg-white rounded-t-2xl p-4 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">Hole by Hole</h2>
          <button
            data-testid="drilldown-close"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Front nine */}
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 mb-2">Front Nine (1–9)</p>
          <div data-testid="front-nine" className="grid grid-cols-9 gap-1">
            {frontNine.map((hole) => (
              <HoleCell key={hole.holeNumber} hole={hole} />
            ))}
          </div>
        </div>

        {/* Back nine */}
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">Back Nine (10–18)</p>
          <div data-testid="back-nine" className="grid grid-cols-9 gap-1">
            {backNine.map((hole) => (
              <HoleCell key={hole.holeNumber} hole={hole} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
