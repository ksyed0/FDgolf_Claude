'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createTeam, joinTeamByCode, switchTeam } from '@/lib/actions/teams'

interface PreassignedTeam {
  teamId: string
  teamName: string
  joinCode: string
}

interface Props {
  tournamentId: string
  playerId: string
  slug: string
  preassignedTeam: PreassignedTeam | null
}

type Mode = 'choose' | 'join' | 'create' | 'done'

export function TeamForm({ tournamentId, playerId, slug, preassignedTeam }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(preassignedTeam ? 'done' : 'choose')
  const [joinCode, setJoinCode] = useState('')
  const [teamName, setTeamName] = useState('')
  const [teamSize, setTeamSize] = useState(4)
  const [isCaptain, setIsCaptain] = useState(false)
  const [assignedTeam, setAssignedTeam] = useState<{ name: string; joinCode: string } | null>(
    preassignedTeam ? { name: preassignedTeam.teamName, joinCode: preassignedTeam.joinCode } : null
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleJoin() {
    setError(null)
    setIsCaptain(false)
    setLoading(true)
    if (preassignedTeam && joinCode) {
      const { data, error: err } = await switchTeam(playerId, joinCode, preassignedTeam.teamId)
      if (err || !data) {
        setError(err ?? 'Failed to switch team')
        setLoading(false)
        return
      }
      setAssignedTeam({ name: data.name, joinCode: data.join_code })
    } else {
      const { data, error: err } = await joinTeamByCode(joinCode, playerId)
      if (err || !data) {
        setError(err ?? 'Failed to join team')
        setLoading(false)
        return
      }
      setAssignedTeam({ name: data.name, joinCode: data.join_code })
    }
    setLoading(false)
    setMode('done')
  }

  async function handleCreate() {
    setError(null)
    setLoading(true)
    const { data, error: err } = await createTeam(tournamentId, teamName, playerId, teamSize)
    if (err || !data) {
      setError(err ?? 'Failed to create team')
      setLoading(false)
      return
    }
    setAssignedTeam({ name: data.name, joinCode: data.join_code })
    setLoading(false)
    setMode('done')
  }

  function handleContinue() {
    if (isCaptain) {
      router.push(`/register/${slug}/captain`)
    } else {
      router.push('/profile')
    }
  }

  if (mode === 'choose') {
    return (
      <div className="space-y-3">
        <Button className="w-full" onClick={() => setMode('join')}>
          Join a team (enter join code)
        </Button>
        <Button className="w-full" variant="outline" onClick={() => setMode('create')}>
          Create a new team
        </Button>
      </div>
    )
  }

  if (mode === 'join') {
    return (
      <div className="space-y-4">
        <h2 className="font-semibold text-gray-800">Join a Team</h2>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {preassignedTeam && (
          <p className="text-sm text-gray-500">
            You were assigned to <strong>{preassignedTeam.teamName}</strong>. Enter a different code
            to override.
          </p>
        )}
        <Input
          placeholder="Team join code (e.g. ABC123)"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          maxLength={6}
          className="font-mono"
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setMode(preassignedTeam ? 'done' : 'choose')}>
            ← Back
          </Button>
          <Button className="flex-1" onClick={handleJoin} disabled={joinCode.length < 4 || loading}>
            {loading ? 'Joining…' : 'Join team →'}
          </Button>
        </div>
      </div>
    )
  }

  if (mode === 'create') {
    return (
      <div className="space-y-4">
        <h2 className="font-semibold text-gray-800">Create a Team</h2>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <Input
          placeholder="Team name"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
        />
        <div>
          <label className="text-sm font-medium text-gray-700" htmlFor="team-size">
            Team size
          </label>
          <select
            id="team-size"
            aria-label="team size"
            value={teamSize}
            onChange={(e) => setTeamSize(parseInt(e.target.value, 10))}
            className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
          >
            {[2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} players
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setMode('choose')}>
            ← Back
          </Button>
          <Button className="flex-1" onClick={handleCreate} disabled={!teamName.trim() || loading}>
            {loading ? 'Creating…' : 'Create team →'}
          </Button>
        </div>
      </div>
    )
  }

  // mode === 'done'
  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-1">
        <p className="text-sm font-medium text-green-800">Team: {assignedTeam?.name}</p>
        <p className="text-sm text-green-700">
          Join code: <span className="font-mono font-bold">{assignedTeam?.joinCode}</span>
        </p>
        <p className="text-xs text-green-600">Share this code with teammates</p>
      </div>
      {!preassignedTeam && (
        <button
          type="button"
          onClick={() => setMode('join')}
          className="text-sm text-gray-500 hover:underline"
        >
          Enter a different join code
        </button>
      )}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isCaptain}
          onChange={(e) => setIsCaptain(e.target.checked)}
          className="mt-1 w-4 h-4"
          aria-label="I am the team captain"
        />
        <span className="text-sm text-gray-700">
          I&apos;m the team captain — I&apos;ll invite my teammates
        </span>
      </label>
      <Button className="w-full" onClick={handleContinue}>
        Continue →
      </Button>
    </div>
  )
}
