'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StepTeam } from './step-team'
import { getPlayerByEmail, createPlayer } from '@/lib/actions/players'
import { createRegistration, markRegistered } from '@/lib/actions/registrations'
import { claimInvitation } from '@/lib/actions/invitations'

type Step = 'profile' | 'password' | 'team' | 'confirm'

interface Tournament {
  id: string
  name: string
  slug: string
}
interface PrefillPlayer {
  id: string
  email: string
  full_name: string
  phone: string | null
  handicap: number | null
  company: string | null
  title: string | null
}

interface Props {
  tournament: Tournament
  prefill: { player: PrefillPlayer; token: string } | null
}

export function RegistrationWizard({ tournament, prefill }: Props) {
  const [step, setStep] = useState<Step>('profile')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [fullName, setFullName] = useState(prefill?.player.full_name ?? '')
  const [email] = useState(prefill?.player.email ?? '')
  const [emailInput, setEmailInput] = useState(prefill?.player.email ?? '')
  const [phone, setPhone] = useState(prefill?.player.phone ?? '')
  const [handicap, setHandicap] = useState(prefill?.player.handicap?.toString() ?? '')
  const [company, setCompany] = useState(prefill?.player.company ?? '')
  const [title, setTitle] = useState(prefill?.player.title ?? '')
  const [password, setPassword] = useState('')
  const [confirmedPlayerId, setConfirmedPlayerId] = useState(prefill?.player.id ?? '')
  const [teamJoinCode, setTeamJoinCode] = useState('')
  const [confirmedTeamName, setConfirmedTeamName] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleProfileNext() {
    setError(null)
    if (!prefill) {
      setLoading(true)
      const { data: existing } = await getPlayerByEmail(emailInput)
      setLoading(false)
      if (existing) {
        setError('An account with this email already exists. Check your invite email or sign in.')
        return
      }
    }
    setStep('password')
  }

  async function handlePasswordNext() {
    setError(null)
    setLoading(true)
    const effectiveEmail = prefill ? email : emailInput
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: effectiveEmail,
      password,
    })
    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (prefill) {
      const { error: claimErr } = await claimInvitation(prefill.token)
      if (claimErr) {
        setError(claimErr)
        setLoading(false)
        return
      }
    } else {
      const { data: player, error: pErr } = await createPlayer({
        email: effectiveEmail,
        full_name: fullName,
        phone: phone || null,
        handicap: handicap ? parseFloat(handicap) : null,
        company: company || null,
        title: title || null,
      })
      if (pErr || !player) {
        setError(pErr ?? 'Failed to create player')
        setLoading(false)
        return
      }
      setConfirmedPlayerId(player.id)
      const { error: regErr } = await createRegistration(tournament.id, player.id, 'registered')
      if (regErr) {
        setError(regErr)
        setLoading(false)
        return
      }
    }
    setLoading(false)
    setStep('team')
  }

  const steps: Step[] = ['profile', 'password', 'team', 'confirm']
  const stepIdx = steps.indexOf(step)

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{tournament.name}</h1>
          <p className="text-sm text-gray-500">Player Registration</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2" aria-label="Registration steps">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                ${i <= stepIdx ? 'bg-green-700 text-white' : 'bg-gray-200 text-gray-500'}`}
              >
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`h-0.5 w-8 ${i < stepIdx ? 'bg-green-700' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <p
            role="alert"
            className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
          >
            {error}
          </p>
        )}

        {/* Step 1: Profile */}
        {step === 'profile' && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-800">Your Details</h2>
            <Input
              placeholder="Full name *"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            {prefill ? (
              <Input value={email} disabled className="bg-gray-50 text-gray-500" />
            ) : (
              <Input
                type="email"
                placeholder="Email *"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
              />
            )}
            <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input
              type="number"
              placeholder="Handicap"
              value={handicap}
              onChange={(e) => setHandicap(e.target.value)}
            />
            <Input
              placeholder="Company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Button
              className="w-full"
              onClick={handleProfileNext}
              disabled={!fullName || (!prefill && !emailInput) || loading}
            >
              {loading ? 'Checking…' : 'Next →'}
            </Button>
          </div>
        )}

        {/* Step 2: Password */}
        {step === 'password' && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-800">Create Password</h2>
            <Input
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('profile')}>
                ← Back
              </Button>
              <Button
                className="flex-1"
                onClick={handlePasswordNext}
                disabled={password.length < 6 || loading}
              >
                {loading ? 'Creating account…' : 'Next →'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Team */}
        {step === 'team' && (
          <StepTeam
            tournamentId={tournament.id}
            playerId={confirmedPlayerId}
            prefillTeamId={prefill ? 'prefilled' : null}
            onComplete={(name, code) => {
              setConfirmedTeamName(name)
              setTeamJoinCode(code)
              setStep('confirm')
            }}
            onBack={() => setStep('password')}
          />
        )}

        {/* Step 4: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4 text-center">
            <div className="text-4xl">🎉</div>
            <h2 className="font-bold text-xl text-gray-900">You're registered!</h2>
            <p className="text-gray-600">{tournament.name}</p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left space-y-1">
              <p className="text-sm font-medium text-green-800">Team: {confirmedTeamName}</p>
              <p className="text-sm text-green-700">
                Join code: <span className="font-mono font-bold">{teamJoinCode}</span>
              </p>
              <p className="text-xs text-green-600">Share this code with your teammates</p>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
