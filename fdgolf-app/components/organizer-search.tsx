'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  searchPlayersAction,
  assignOrganizerAction,
} from '@/lib/actions/roles'

interface OrganizerSearchProps {
  tournamentId: string
  tournamentName: string
}

interface PlayerResult {
  id: string
  name: string
  email: string
}

export function OrganizerSearch({
  tournamentId,
  tournamentName,
}: OrganizerSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlayerResult[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [assignStatus, setAssignStatus] = useState<
    Record<string, { success: boolean; message: string }>
  >({})

  const [isSearchPending, startSearchTransition] = useTransition()
  const [isAssignPending, startAssignTransition] = useTransition()

  function handleSearch() {
    setSearchError(null)
    setHasSearched(false)
    startSearchTransition(async () => {
      const { players, error } = await searchPlayersAction(query)
      setResults(players)
      setSearchError(error)
      setHasSearched(true)
    })
  }

  function handleAssign(playerId: string) {
    startAssignTransition(async () => {
      const { error } = await assignOrganizerAction(tournamentId, playerId)
      setAssignStatus((prev) => ({
        ...prev,
        [playerId]: error
          ? { success: false, message: error }
          : {
              success: true,
              message: `Assigned as organizer for ${tournamentName}`,
            },
      }))
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search players by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          aria-label="Search players"
        />
        <Button
          onClick={handleSearch}
          disabled={isSearchPending || query.trim().length === 0}
        >
          {isSearchPending ? 'Searching…' : 'Search'}
        </Button>
      </div>

      {searchError && (
        <p className="text-sm text-destructive" role="alert">
          {searchError}
        </p>
      )}

      {hasSearched && results.length === 0 && !searchError && (
        <p className="text-sm text-muted-foreground">No players found.</p>
      )}

      {results.length > 0 && (
        <ul className="space-y-2" aria-label="Player search results">
          {results.map((player) => {
            const status = assignStatus[player.id]
            return (
              <li key={player.id}>
                <Card>
                  <CardContent className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">{player.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {player.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {status && (
                        <span
                          className={
                            status.success
                              ? 'text-sm text-green-600'
                              : 'text-sm text-destructive'
                          }
                          role="status"
                        >
                          {status.message}
                        </span>
                      )}
                      <Button
                        size="sm"
                        disabled={
                          isAssignPending ||
                          assignStatus[player.id]?.success === true
                        }
                        onClick={() => handleAssign(player.id)}
                      >
                        {assignStatus[player.id]?.success
                          ? 'Organizer assigned'
                          : 'Make organizer'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
