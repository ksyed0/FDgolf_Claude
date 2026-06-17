'use client'

import { useMemo } from 'react'
import { computeNextPlayer, type TurnMember } from '@/lib/round/turn'
import { haversineMeters, metersToYards } from '@/lib/round/distance'
import type { LatLng } from '@/lib/round/types'

type Member = TurnMember & { name: string }

type Props = {
  members: Member[]
  pin: LatLng
  onSelect: (playerId: string) => void
}

export function TurnPicker({ members, pin, onSelect }: Props) {
  const auto = useMemo(() => computeNextPlayer(members, pin), [members, pin])
  const active = members.filter((m) => !m.sunk && m.lastOrigin)
  const selectedName = members.find((m) => m.playerId === auto)?.name ?? '—'

  return (
    <div className="flex flex-col gap-2 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">Who&apos;s away?</p>
      <p data-testid="turn-selected" className="text-lg font-bold text-green-400">
        {selectedName}
      </p>
      {active.map((m) => (
        <button
          key={m.playerId}
          onClick={() => onSelect(m.playerId)}
          className={`flex items-center justify-between rounded px-3 py-2 ${
            m.playerId === auto ? 'bg-green-900 font-bold' : 'bg-slate-800'
          }`}
        >
          <span>{m.name}</span>
          <span className="text-xs text-slate-400">
            ~{Math.round(metersToYards(haversineMeters(m.lastOrigin as LatLng, pin)))} yds
          </span>
        </button>
      ))}
    </div>
  )
}
