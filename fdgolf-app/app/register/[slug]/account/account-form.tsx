'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createAccountAction } from '@/lib/actions/account'

interface Props {
  tournamentId: string
  slug: string
  prefill: { email: string; fullName: string; token: string } | null
}

export function AccountForm({ tournamentId, slug, prefill }: Props) {
  const router = useRouter()
  const [fullName, setFullName] = useState(prefill?.fullName ?? '')
  const [email, setEmail] = useState(prefill?.email ?? '')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [title, setTitle] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('')
  const [handicap, setHandicap] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword
  const passwordTooShort = password.length > 0 && password.length < 8

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setError(null)
    setLoading(true)
    const result = await createAccountAction(
      {
        fullName,
        email,
        phone: phone || null,
        password,
        handicap: handicap ? parseFloat(handicap) : null,
        company: company || null,
        title: title || null,
        dob: dob || null,
        gender: gender || null,
      },
      tournamentId,
      prefill?.token ?? null
    )
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      router.push(`/register/${slug}/team`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        placeholder="Full name *"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        required
        disabled={!!prefill}
        className={prefill ? 'bg-gray-50 text-gray-600' : ''}
      />
      <Input
        type="email"
        placeholder="Email *"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={!!prefill}
        className={prefill ? 'bg-gray-50 text-gray-600' : ''}
      />
      <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <Input placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
      <Input placeholder="Title / Role" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input
        type="number"
        step="0.1"
        placeholder="Handicap"
        value={handicap}
        onChange={(e) => setHandicap(e.target.value)}
      />
      <Input
        type="date"
        placeholder="Date of birth"
        value={dob}
        onChange={(e) => setDob(e.target.value)}
      />
      <select
        value={gender}
        onChange={(e) => setGender(e.target.value)}
        className="w-full border rounded-md px-3 py-2 text-sm"
      >
        <option value="">Gender (optional)</option>
        <option value="male">Male</option>
        <option value="female">Female</option>
        <option value="non_binary">Non-binary</option>
        <option value="prefer_not_to_say">Prefer not to say</option>
      </select>

      <div className="border-t pt-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">Create password</p>
        <Input
          type="password"
          placeholder="Password (min 8 characters) *"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={passwordTooShort ? 'border-red-300' : ''}
        />
        <Input
          type="password"
          placeholder="Confirm password *"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className={passwordMismatch ? 'border-red-300' : ''}
        />
        {passwordMismatch && <p className="text-xs text-red-500">Passwords do not match</p>}
      </div>

      {error && (
        <p
          role="alert"
          className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
        >
          {error}
        </p>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={
          loading ||
          !fullName ||
          !email ||
          !password ||
          !confirmPassword ||
          passwordMismatch ||
          passwordTooShort
        }
      >
        {loading ? 'Creating account…' : 'Create account →'}
      </Button>
    </form>
  )
}
