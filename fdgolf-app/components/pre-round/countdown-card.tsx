'use client'

import { useEffect, useState } from 'react'

interface Props {
  startsAt: string
  tournamentStatus: string
  holeNumber: number
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

export function CountdownCard({ startsAt, tournamentStatus, holeNumber }: Props) {
  const [msLeft, setMsLeft] = useState(() => new Date(startsAt).getTime() - Date.now())

  useEffect(() => {
    if (tournamentStatus !== 'active') return
    const id = setInterval(() => {
      setMsLeft(new Date(startsAt).getTime() - Date.now())
    }, 1000)
    return () => clearInterval(id)
  }, [startsAt, tournamentStatus])

  if (tournamentStatus !== 'active') {
    return (
      <div className="rounded-lg bg-blue-950 px-4 py-3 text-center">
        <p className="text-sm text-blue-300">Registration open — play starts soon</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-blue-950 px-4 py-3 text-center">
      <p role="timer" className="text-3xl font-bold tracking-widest text-blue-400">
        {formatCountdown(msLeft)}
      </p>
      <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
        Until tee time — Hole {holeNumber}
      </p>
    </div>
  )
}
