'use client'
import { useState } from 'react'

interface TeamMember {
  player_id: string
  players: { full_name: string; email: string } | null
}
interface Team {
  id: string
  name: string
  join_code: string
  start_hole: number | null
  captain_player_id: string | null
  team_members: TeamMember[]
}

interface Props {
  teams: Team[]
}

export function TeamListClient({ teams }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (teams.length === 0) {
    return <p className="text-gray-400 text-sm">No teams yet.</p>
  }

  return (
    <div className="space-y-3">
      {teams.map((team) => (
        <div key={team.id} className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggle(team.id)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
          >
            <div>
              <span className="font-medium">{team.name}</span>
              <span className="ml-2 text-xs text-gray-400 font-mono">{team.join_code}</span>
              <span className="ml-2 text-xs text-gray-400">
                {team.team_members.length} member{team.team_members.length !== 1 ? 's' : ''}
              </span>
            </div>
            <span className="text-gray-400 text-sm">{expanded.has(team.id) ? '▲' : '▼'}</span>
          </button>
          {expanded.has(team.id) && (
            <div className="divide-y divide-gray-100">
              {team.team_members.map((m) => (
                <div
                  key={m.player_id}
                  className="px-4 py-2 flex items-center justify-between text-sm"
                >
                  <span>{m.players?.full_name ?? '—'}</span>
                  <span className="text-gray-400">{m.players?.email ?? ''}</span>
                  {m.player_id === team.captain_player_id && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                      Captain
                    </span>
                  )}
                </div>
              ))}
              {team.team_members.length === 0 && (
                <p className="px-4 py-2 text-xs text-gray-400">No members yet.</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
