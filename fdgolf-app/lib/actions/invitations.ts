'use server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

export type InvitationData = {
  token: string
  player_id: string
  tournament_id: string
  player: {
    id: string
    email: string
    full_name: string
    phone: string | null
    handicap: number | null
    company: string | null
    title: string | null
  }
  tournament: { id: string; name: string; slug: string }
}

export async function validateInviteToken(
  token: string
): Promise<{ data: InvitationData | null; error: string | null }> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('player_invitations')
    .select(
      `token, player_id, tournament_id,
      player:players(id, email, full_name, phone, handicap, company, title),
      tournament:tournaments(id, name, slug)`
    )
    .eq('token', token)
    .is('claimed_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()
  if (error || !data) return { data: null, error: 'Invalid or expired invite token' }
  return { data: data as unknown as InvitationData, error: null }
}

export async function claimInvitation(token: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const svc = createServiceClient()
  const { data: invitation } = await svc
    .from('player_invitations')
    .select('player_id, tournament_id')
    .eq('token', token)
    .is('claimed_at', null)
    .single()
  if (!invitation) return { error: 'Invalid or expired invite token' }

  await svc.from('players').update({ user_id: user.id }).eq('id', invitation.player_id)
  await svc
    .from('player_invitations')
    .update({ claimed_at: new Date().toISOString() })
    .eq('token', token)
  await svc
    .from('tournament_registrations')
    .update({ status: 'registered', registered_at: new Date().toISOString() })
    .eq('player_id', invitation.player_id)
    .eq('tournament_id', invitation.tournament_id)
  return { error: null }
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function createInvitation(
  playerId: string,
  tournamentId: string,
  slug: string
): Promise<{ data: { token: string; inviteUrl: string } | null; error: string | null }> {
  const supabase = createServiceClient()
  // Hex token generated server-side
  const tokenBytes = Array.from(crypto.getRandomValues(new Uint8Array(32)))
  const token = tokenBytes.map((b) => b.toString(16).padStart(2, '0')).join('')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('player_invitations')
    .upsert(
      {
        player_id: playerId,
        tournament_id: tournamentId,
        token,
        expires_at: expiresAt,
        claimed_at: null,
      },
      { onConflict: 'player_id,tournament_id', ignoreDuplicates: false }
    )
    .select('token')
    .single()
  if (error || !data) return { data: null, error: error?.message ?? 'Failed to create invitation' }

  const inviteUrl = `${APP_URL}/register/${slug}?token=${data.token}`
  return { data: { token: data.token, inviteUrl }, error: null }
}

export async function sendInvitationAction(
  email: string,
  fullName: string,
  playerId: string,
  tournamentId: string,
  slug: string
): Promise<{ data: { inviteUrl: string } | null; error: string | null }> {
  const invResult = await createInvitation(playerId, tournamentId, slug)
  if (invResult.error || !invResult.data) return { data: null, error: invResult.error }

  const { token, inviteUrl } = invResult.data
  const supabase = createServiceClient()
  const { error: emailErr } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${APP_URL}/register/${slug}?token=${token}`,
  })

  if (emailErr) {
    console.log(`[DEV] Invite URL for ${email}: ${inviteUrl}`)
    // Invitation row is persisted — return URL for captain to share manually
    return { data: { inviteUrl }, error: emailErr.message }
  }
  return { data: { inviteUrl }, error: null }
}

export async function sendInviteEmail(
  email: string,
  fullName: string,
  tournamentName: string,
  slug: string,
  token: string
): Promise<{ error: string | null }> {
  const apiKey = process.env.RESEND_API_KEY
  const link = `https://fdgolf.app/register/${slug}?token=${token}`

  if (!apiKey) {
    console.log(`[DEV] Invite URL for ${email}: ${link}`)
    return { error: null }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: 'FDGolf <noreply@fdgolf.app>',
      to: email,
      subject: `You're invited to ${tournamentName}`,
      html: `<p>Hi ${fullName},</p><p>You've been invited to <strong>${tournamentName}</strong>.</p><p><a href="${link}">Complete your registration</a></p>`,
    }),
  })
  if (!res.ok) return { error: `Failed to send email to ${email}` }
  return { error: null }
}
