'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updatePlayer } from '@/lib/actions/players'
import { updateRegistrationStatus } from '@/lib/actions/registrations'

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
interface Props {
  registration: { player: PlayerInfo; status: Status; tournament_id: string }
  onClose: () => void
  onSaved: () => void
}

export function PlayerEditModal({ registration, onClose, onSaved }: Props) {
  const { player, status: initStatus, tournament_id } = registration
  const [fullName, setFullName] = useState(player.full_name)
  const [phone, setPhone] = useState(player.phone ?? '')
  const [handicap, setHandicap] = useState(player.handicap?.toString() ?? '')
  const [company, setCompany] = useState(player.company ?? '')
  const [title, setTitle] = useState(player.title ?? '')
  const [status, setStatus] = useState<Status>(initStatus)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const [pErr, sErr] = await Promise.all([
      updatePlayer(player.id, {
        full_name: fullName,
        phone: phone || null,
        handicap: handicap ? parseFloat(handicap) : null,
        company: company || null,
        title: title || null,
      }),
      status !== initStatus && initStatus !== 'invited'
        ? updateRegistrationStatus(tournament_id, player.id, status as 'registered' | 'withdrawn')
        : Promise.resolve({ error: null }),
    ])
    setSaving(false)
    const err = pErr.error ?? sErr.error
    if (err) setError(err)
    else onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Edit Player</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            ×
          </button>
        </div>
        <p className="text-sm text-gray-500">{player.email}</p>
        <Input
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input
          type="number"
          placeholder="Handicap"
          value={handicap}
          onChange={(e) => setHandicap(e.target.value)}
        />
        <Input placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Registration Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            disabled={initStatus === 'invited'}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-50"
          >
            <option value="registered">Registered</option>
            <option value="withdrawn">Withdrawn</option>
            {initStatus === 'invited' && <option value="invited">Invited (pending)</option>}
          </select>
        </div>
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
