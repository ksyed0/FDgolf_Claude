'use client'

import { useState, useTransition, useCallback, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  searchPlayersAction,
  deletePlayerAction,
  assignTeamAction,
  updatePlayer,
  type PlayerSearchRow,
  type PlayerFilter,
} from '@/lib/actions/players'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
// StatusPill is for tournament statuses; registration statuses use a dedicated badge below.

// ─── Registration Status Badge ────────────────────────────────────────────────

const REGISTRATION_STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  registered: { label: 'Registered', classes: 'bg-green-100 text-green-800' },
  invited: { label: 'Invited', classes: 'bg-blue-100 text-blue-700' },
  withdrawn: { label: 'Withdrawn', classes: 'bg-red-100 text-red-700' },
}

function RegistrationStatusBadge({ status }: { status: string }) {
  const config = REGISTRATION_STATUS_CONFIG[status] ?? {
    label: status,
    classes: 'bg-gray-100 text-gray-600',
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.classes}`}
    >
      {config.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface Team {
  id: string
  name: string
  team_size: number
  member_count: number
}

interface Props {
  tournamentId: string
  teams: Team[]
  initialPlayers: PlayerSearchRow[]
  initialTotal: number
}

const PAGE_SIZE = 50

export function PlayerListClient({ tournamentId, teams, initialPlayers, initialTotal }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const [players, setPlayers] = useState(initialPlayers)
  const [total, setTotal] = useState(initialTotal)
  const [, startTransition] = useTransition()
  const [editingPlayer, setEditingPlayer] = useState<PlayerSearchRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PlayerSearchRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [resetPwState, setResetPwState] = useState<{ playerId: string; sent: boolean } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeFilters = searchParams.getAll('filter') as PlayerFilter[]
  const currentQuery = searchParams.get('q') ?? ''
  const currentPage = parseInt(searchParams.get('page') ?? '0', 10)

  const fetchPlayers = useCallback(
    (q: string, filters: PlayerFilter[], page: number) => {
      startTransition(async () => {
        const result = await searchPlayersAction(q, tournamentId, page, filters)
        if (!result.error) {
          setPlayers(result.data)
          setTotal(result.total)
        }
      })
    },
    [tournamentId]
  )

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => {
      if (v === null) params.delete(k)
      else params.set(k, v)
    })
    router.replace(`${pathname}?${params.toString()}`)
  }

  function handleSearchChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateParams({ q: value || null, page: null })
      fetchPlayers(value, activeFilters, 0)
    }, 300)
  }

  function toggleFilter(filter: PlayerFilter) {
    const current = searchParams.getAll('filter') as PlayerFilter[]
    const next = current.includes(filter)
      ? current.filter((f) => f !== filter)
      : [...current, filter]
    const params = new URLSearchParams(searchParams.toString())
    params.delete('filter')
    next.forEach((f) => params.append('filter', f))
    params.delete('page')
    router.replace(`${pathname}?${params.toString()}`)
    fetchPlayers(currentQuery, next, 0)
  }

  async function handleTeamChange(playerId: string, newTeamId: string) {
    const result = await assignTeamAction(playerId, newTeamId || null, tournamentId)
    if (!result.error) fetchPlayers(currentQuery, activeFilters, currentPage)
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    const result = await deletePlayerAction(deleteTarget.id, tournamentId)
    if (result.error) {
      setDeleteError(result.error)
    } else {
      setDeleteTarget(null)
      setDeleteError(null)
      fetchPlayers(currentQuery, activeFilters, currentPage)
    }
  }

  async function handleResetPw(playerId: string, email: string) {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email)
    setResetPwState({ playerId, sent: true })
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <Input
        placeholder="Search by name, email, company…"
        defaultValue={currentQuery}
        onChange={(e) => handleSearchChange(e.target.value)}
        className="max-w-md"
      />

      {/* Filter chips */}
      <div className="flex gap-2">
        {(['unassigned', 'withdrawn'] as PlayerFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => toggleFilter(f)}
            data-active={activeFilters.includes(f) ? 'true' : 'false'}
            className={`text-sm px-3 py-1 rounded-full border ${
              activeFilters.includes(f)
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Company</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Team</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{p.full_name}</td>
                <td className="px-4 py-3 text-gray-500">{p.company ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{p.email}</td>
                <td className="px-4 py-3">
                  <select
                    aria-label="team"
                    value={p.team_id ?? ''}
                    onChange={(e) => handleTeamChange(p.id, e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {teams.map((t) => {
                      const full = t.member_count >= t.team_size
                      const isCurrentTeam = t.id === p.team_id
                      return (
                        <option key={t.id} value={t.id} disabled={full && !isCurrentTeam}>
                          {full && !isCurrentTeam ? `${t.name} (full)` : t.name}
                        </option>
                      )
                    })}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <RegistrationStatusBadge status={p.registration_status} />
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    type="button"
                    onClick={() => setEditingPlayer(p)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (resetPwState?.playerId === p.id) return
                      handleResetPw(p.id, p.email)
                    }}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    {resetPwState?.playerId === p.id && resetPwState.sent ? 'Sent ✓' : 'Reset PW'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteTarget(p)
                      setDeleteError(null)
                    }}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {players.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                  No players match your search.{' '}
                  {(activeFilters.length > 0 || currentQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        updateParams({ q: null, filter: null })
                        fetchPlayers('', [], 0)
                      }}
                      className="underline"
                    >
                      Clear filters
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex gap-2 items-center text-sm">
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => {
              updateParams({ page: String(currentPage - 1) })
              fetchPlayers(currentQuery, activeFilters, currentPage - 1)
            }}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            ← Prev
          </button>
          <span>
            {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, total)} of{' '}
            {total}
          </span>
          <button
            type="button"
            disabled={(currentPage + 1) * PAGE_SIZE >= total}
            onClick={() => {
              updateParams({ page: String(currentPage + 1) })
              fetchPlayers(currentQuery, activeFilters, currentPage + 1)
            }}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}

      {/* Edit Sheet */}
      {editingPlayer && (
        <PlayerEditSheet
          player={editingPlayer}
          onClose={() => setEditingPlayer(null)}
          onSaved={() => {
            setEditingPlayer(null)
            fetchPlayers(currentQuery, activeFilters, currentPage)
          }}
        />
      )}

      {/* Delete AlertDialog */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h2 className="font-semibold text-lg">Delete player?</h2>
            <p className="text-sm text-gray-600">
              Are you sure you want to remove <strong>{deleteTarget.full_name}</strong> from this
              tournament? Their round history will be preserved.
            </p>
            {deleteError && (
              <p role="alert" className="text-sm text-red-600">
                {deleteError}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteTarget(null)
                  setDeleteError(null)
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Inline edit sheet component
function PlayerEditSheet({
  player,
  onClose,
  onSaved,
}: {
  player: PlayerSearchRow
  onClose: () => void
  onSaved: () => void
}) {
  const [fullName, setFullName] = useState(player.full_name)
  const [phone, setPhone] = useState(player.phone ?? '')
  const [company, setCompany] = useState(player.company ?? '')
  const [title, setTitle] = useState(player.title ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const result = await updatePlayer(player.id, {
      full_name: fullName,
      phone: phone || null,
      company: company || null,
      title: title || null,
    })
    setSaving(false)
    if (result.error) setError(result.error)
    else onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Edit Player</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            ×
          </button>
        </div>
        <p className="text-sm text-gray-500">{player.email} — read-only</p>
        <Input
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
