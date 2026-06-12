'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createTeam, joinTeamByCode, switchTeam } from '@/lib/actions/teams'

interface Props {
  tournamentId: string
  playerId: string
  prefillTeamId: string | null
  onComplete: (teamName: string, joinCode: string) => void
  onBack: () => void
}

export function StepTeam({ tournamentId, playerId, prefillTeamId, onComplete, onBack }: Props) {
  const [mode, setMode] = useState<'choose' | 'join' | 'create'>('choose')
  const [joinCode, setJoinCode] = useState('')
  const [teamName, setTeamName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleJoin() {
    setError(null)
    setLoading(true)
    if (prefillTeamId) {
      const { data, error: err } = await switchTeam(playerId, joinCode, prefillTeamId)
      if (err || !data) {
        setError(err ?? 'Failed to switch team')
        setLoading(false)
        return
      }
      onComplete(data.name, data.join_code)
    } else {
      const { data, error: err } = await joinTeamByCode(joinCode, playerId)
      if (err || !data) {
        setError(err ?? 'Failed to join team')
        setLoading(false)
        return
      }
      onComplete(data.name, data.join_code)
    }
    setLoading(false)
  }

  async function handleCreate() {
    setError(null)
    setLoading(true)
    const { data, error: err } = await createTeam(tournamentId, teamName, playerId)
    if (err || !data) {
      setError(err ?? 'Failed to create team')
      setLoading(false)
      return
    }
    setLoading(false)
    onComplete(data.name, data.join_code)
  }

  if (mode === 'choose') {
    return (
      <div className="space-y-4">
        <h2 className="font-semibold text-gray-800">Your Team</h2>
        <Button className="w-full" onClick={() => setMode('join')}>
          Join a team (enter join code)
        </Button>
        <Button className="w-full" variant="outline" onClick={() => setMode('create')}>
          Create a new team
        </Button>
        <Button variant="ghost" onClick={onBack}>
          ← Back
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
        <Input
          placeholder="Team join code (e.g. ABC123)"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          maxLength={6}
          className="font-mono"
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setMode('choose')}>
            ← Back
          </Button>
          <Button className="flex-1" onClick={handleJoin} disabled={joinCode.length < 4 || loading}>
            {loading ? 'Joining…' : 'Join team →'}
          </Button>
        </div>
      </div>
    )
  }

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
