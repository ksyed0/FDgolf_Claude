'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updatePlayer, type PlayerRow } from '@/lib/actions/players'

interface Props {
  player: PlayerRow
}

export function ProfileForm({ player }: Props) {
  const [fullName, setFullName] = useState(player.full_name)
  const [phone, setPhone] = useState(player.phone ?? '')
  const [handicap, setHandicap] = useState(player.handicap?.toString() ?? '')
  const [company, setCompany] = useState(player.company ?? '')
  const [title, setTitle] = useState(player.title ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    const { error: err } = await updatePlayer(player.id, {
      full_name: fullName,
      phone: phone || null,
      handicap: handicap ? parseFloat(handicap) : null,
      company: company || null,
      title: title || null,
    })
    setSaving(false)
    if (err) setError(err)
    else setSaved(true)
  }

  return (
    <div className="space-y-4 max-w-md">
      <div>
        <label className="text-sm font-medium text-gray-700">Email</label>
        <Input value={player.email} disabled className="bg-gray-50 text-gray-500 mt-1" />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Full name</label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1" />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Phone</label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Handicap</label>
        <Input
          type="number"
          value={handicap}
          onChange={(e) => setHandicap(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Company</label>
        <Input value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1" />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Title</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-green-600">
          Profile saved.
        </p>
      )}
      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  )
}
