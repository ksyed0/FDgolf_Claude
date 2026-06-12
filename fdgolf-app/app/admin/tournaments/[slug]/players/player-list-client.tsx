'use client'
import { useState } from 'react'
import { PlayerEditModal } from './player-edit-modal'

type Status = 'invited' | 'registered' | 'withdrawn'
interface PlayerInfo {
  id: string
  email: string
  full_name: string
  phone: string | null
  handicap: number | null
  company: string | null
  title: string | null
}
interface Registration {
  id: string
  status: Status
  player: PlayerInfo
}

interface Props {
  registrations: Registration[]
  tournamentId: string
}

const STATUS_BADGE: Record<Status, string> = {
  invited: 'bg-yellow-100 text-yellow-800',
  registered: 'bg-green-100 text-green-800',
  withdrawn: 'bg-gray-100 text-gray-500',
}

export function PlayerListClient({ registrations, tournamentId }: Props) {
  const [filter, setFilter] = useState<Status | 'all'>('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Registration | null>(null)
  const [list, setList] = useState(registrations)

  const filtered = list.filter(
    (r) =>
      (filter === 'all' || r.status === filter) &&
      r.player.full_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div className="flex gap-3 mb-4">
        <input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Status | 'all')}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="invited">Invited</option>
          <option value="registered">Registered</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
      </div>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{r.player.full_name}</td>
                <td className="px-4 py-3 text-gray-500">{r.player.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_BADGE[r.status]}`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setEditing(r)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  No players found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && (
        <PlayerEditModal
          registration={{
            player: editing.player,
            status: editing.status,
            tournament_id: tournamentId,
          }}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setList((prev) => prev.map((r) => (r.id === editing.id ? { ...r } : r)))
            setEditing(null)
          }}
        />
      )}
    </>
  )
}
