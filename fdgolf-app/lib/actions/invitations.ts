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
