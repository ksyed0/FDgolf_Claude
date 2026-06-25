'use server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createRegistration } from '@/lib/actions/registrations'
import { claimInvitation } from '@/lib/actions/invitations'

export type AccountFormData = {
  fullName: string
  email: string
  phone: string | null
  password: string
  handicap: number | null
  company: string | null
  title: string | null
  dob: string | null
  gender: string | null
}

export async function createAccountAction(
  data: AccountFormData,
  tournamentId: string,
  token: string | null
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
  })
  if (authErr) return { error: authErr.message }
  const userId = authData.user?.id
  if (!userId) return { error: 'Authentication failed' }

  const svc = createServiceClient()

  if (token) {
    // Validate that the invitation token belongs to this email address
    // before allowing the claim — prevents account takeover via token misuse.
    const { data: invite } = await svc
      .from('player_invitations')
      .select('player_id, players!inner(email)')
      .eq('token', token)
      .is('claimed_at', null)
      .single()
    if (!invite || (invite.players as unknown as { email: string }).email !== data.email) {
      await svc.auth.admin.deleteUser(userId)
      return { error: 'Invitation token does not match this email address.' }
    }

    // CSV claim path — update existing players row
    const { error: updateErr } = await svc
      .from('players')
      .update({
        user_id: userId,
        full_name: data.fullName,
        phone: data.phone,
        company: data.company,
        title: data.title,
        handicap: data.handicap,
        dob: data.dob,
        gender: data.gender,
      })
      .eq('email', data.email)
    if (updateErr) {
      await svc.auth.admin.deleteUser(userId)
      return { error: updateErr.message }
    }
    // claimInvitation marks the invitation as claimed AND updates
    // tournament_registrations.status → 'registered'. The registration row
    // was created with status 'invited' during CSV import, so no separate
    // createRegistration call is needed on this path.
    const { error: claimErr } = await claimInvitation(token)
    if (claimErr) {
      await svc.auth.admin.deleteUser(userId)
      return { error: claimErr }
    }
  } else {
    // New player path
    const { data: player, error: playerErr } = await svc
      .from('players')
      .insert({
        user_id: userId,
        email: data.email,
        full_name: data.fullName,
        phone: data.phone,
        handicap: data.handicap,
        company: data.company,
        title: data.title,
        dob: data.dob,
        gender: data.gender,
      })
      .select('id')
      .single()
    if (playerErr || !player) {
      await svc.auth.admin.deleteUser(userId)
      return { error: playerErr?.message ?? 'Failed to create player' }
    }
    const { error: regErr } = await createRegistration(tournamentId, player.id, 'registered')
    if (regErr) {
      await svc.auth.admin.deleteUser(userId)
      return { error: regErr }
    }
  }

  return { error: null }
}
