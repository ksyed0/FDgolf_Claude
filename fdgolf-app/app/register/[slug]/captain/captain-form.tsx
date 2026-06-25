'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { sendInvitationAction } from '@/lib/actions/invitations'

interface Member {
  player_id: string
  full_name: string
  email: string
  is_captain: boolean
}

interface Team {
  id: string
  name: string
  join_code: string
  team_size: number
}

interface Props {
  team: Team
  members: Member[]
  tournamentId: string
  slug: string
}

type SlotState =
  | { status: 'empty' }
  | { status: 'pending'; name: string; email: string }
  | { status: 'sent'; name: string }
  | { status: 'failed'; inviteUrl: string; name: string; email: string }

export function CaptainForm({ team, members, tournamentId, slug }: Props) {
  const router = useRouter()
  const emptySlotCount = Math.max(team.team_size - members.length, 0)
  const [slots, setSlots] = useState<SlotState[]>(
    Array.from({ length: emptySlotCount }, () => ({ status: 'empty' }))
  )
  const [inputs, setInputs] = useState<Array<{ name: string; email: string }>>(
    Array.from({ length: emptySlotCount }, () => ({ name: '', email: '' }))
  )
  const [loading, setLoading] = useState<number | null>(null)

  function updateInput(index: number, field: 'name' | 'email', value: string) {
    setInputs((prev) => prev.map((inp, i) => (i === index ? { ...inp, [field]: value } : inp)))
  }

  async function handleInvite(index: number) {
    const inp = inputs[index]
    if (!inp.name || !inp.email) return
    setLoading(index)

    const result = await sendInvitationAction(
      inp.email,
      inp.name,
      '', // playerId resolved inside action
      tournamentId,
      slug
    )
    setLoading(null)
    if (!result.error) {
      setSlots((prev) => prev.map((s, i) => (i === index ? { status: 'sent', name: inp.name } : s)))
    } else {
      setSlots((prev) =>
        prev.map((s, i) =>
          i === index
            ? {
                status: 'failed',
                inviteUrl: result.data?.inviteUrl ?? '',
                name: inp.name,
                email: inp.email,
              }
            : s
        )
      )
    }
  }

  return (
    <div className="space-y-4">
      {/* Existing members */}
      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.player_id} className="flex items-center gap-2 text-sm text-gray-700">
            <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
              {m.is_captain ? '★' : '✓'}
            </span>
            <span className="font-medium">{m.full_name}</span>
            <span className="text-gray-400">{m.email}</span>
          </div>
        ))}
      </div>

      {/* Join code */}
      <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Team join code</p>
        <p className="text-2xl font-mono font-bold tracking-widest text-gray-900 mt-1">
          {team.join_code}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Share this code with teammates who already have the app
        </p>
      </div>

      {/* Empty slots */}
      {slots.map((slot, index) => (
        <div key={index} className="border rounded-lg p-3 space-y-2">
          {slot.status === 'sent' ? (
            <p className="text-sm text-green-700 font-medium">Invited {slot.name} ✓</p>
          ) : slot.status === 'failed' ? (
            <div className="space-y-2">
              <p className="text-sm text-amber-700">
                Email failed — share this link with {slot.name}:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={slot.inviteUrl}
                  className="flex-1 text-xs border rounded px-2 py-1 font-mono bg-gray-50"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(slot.inviteUrl)}
                >
                  Copy link
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Input
                placeholder="Teammate name"
                value={inputs[index].name}
                onChange={(e) => updateInput(index, 'name', e.target.value)}
                className="h-8 text-sm"
              />
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Teammate email"
                  value={inputs[index].email}
                  onChange={(e) => updateInput(index, 'email', e.target.value)}
                  className="flex-1 h-8 text-sm"
                />
                <Button
                  size="sm"
                  onClick={() => handleInvite(index)}
                  disabled={!inputs[index].name || !inputs[index].email || loading === index}
                >
                  {loading === index ? '…' : 'Invite'}
                </Button>
              </div>
            </>
          )}
        </div>
      ))}

      {slots.length === 0 && <p className="text-sm text-gray-500">Your team is full.</p>}

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={() => router.push('/profile')} className="flex-1">
          Done — go to profile
        </Button>
      </div>
    </div>
  )
}
