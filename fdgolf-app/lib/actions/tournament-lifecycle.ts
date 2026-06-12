'use server'

import { createClient } from '@/lib/supabase/server'

export type PreflightCheck = {
  key: string
  label: string
  passed: boolean
  advisory: boolean
}

export type PreflightResult = {
  checks: PreflightCheck[]
  allBlockingPassed: boolean
}

const VALID_TRANSITIONS: Record<string, string> = {
  draft: 'registration_open',
  registration_open: 'active',
  active: 'completed',
}

export async function getPreflightChecks(
  tournamentId: string,
  targetStatus: 'registration_open' | 'active'
): Promise<PreflightResult> {
  const supabase = await createClient()

  const { data: t } = await supabase
    .from('tournaments')
    .select('id, name, slug, starts_at, venue_id, course_id')
    .eq('id', tournamentId)
    .single()

  if (!t) return { checks: [], allBlockingPassed: false }

  if (targetStatus === 'registration_open') {
    const { count: orgCount } = await supabase
      .from('user_roles')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .eq('role', 'tournament_organizer')

    const checks: PreflightCheck[] = [
      {
        key: 'name_date',
        label: 'Name & date set',
        passed: Boolean(t.name?.trim()) && Boolean(t.starts_at),
        advisory: false,
      },
      {
        key: 'slug_unique',
        label: 'Slug unique',
        passed: Boolean(t.slug?.trim()),
        advisory: false,
      },
      {
        key: 'venue_linked',
        label: 'Venue linked',
        passed: Boolean(t.venue_id),
        advisory: false,
      },
      {
        key: 'course_linked',
        label: 'Course linked',
        passed: Boolean(t.course_id),
        advisory: false,
      },
      {
        key: 'organizer',
        label: 'Organizer assigned',
        passed: (orgCount ?? 0) > 0,
        advisory: true,
      },
    ]

    return {
      checks,
      allBlockingPassed: checks.filter((c) => !c.advisory).every((c) => c.passed),
    }
  }

  // targetStatus === 'active'
  const { data: course } = await supabase
    .from('courses')
    .select('holes_count')
    .eq('id', t.course_id!)
    .single()

  const holesCount = course?.holes_count ?? 18

  const { count: configuredHoles } = await supabase
    .from('holes')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', t.course_id!)
    .not('par', 'is', null)

  const { count: pinnedHoles } = await supabase
    .from('holes')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', t.course_id!)
    .not('pin_lat', 'is', null)

  const { count: teamCount } = await supabase
    .from('teams')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)

  const { count: registrantCount } = await supabase
    .from('tournament_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournamentId)

  const checks: PreflightCheck[] = [
    {
      key: 'holes_configured',
      label: `All ${holesCount} holes configured`,
      passed: (configuredHoles ?? 0) >= holesCount,
      advisory: false,
    },
    {
      key: 'pins_placed',
      label: `All ${holesCount} pins placed`,
      passed: (pinnedHoles ?? 0) >= holesCount,
      advisory: false,
    },
    {
      key: 'teams_assigned',
      label: 'Teams assigned',
      passed: (teamCount ?? 0) > 0,
      advisory: true,
    },
    {
      key: 'registrants',
      label: 'At least 1 registrant',
      passed: (registrantCount ?? 0) > 0,
      advisory: true,
    },
  ]

  return {
    checks,
    allBlockingPassed: checks.filter((c) => !c.advisory).every((c) => c.passed),
  }
}

export async function transitionTournamentAction(
  tournamentId: string,
  targetStatus: 'registration_open' | 'active' | 'completed'
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: isAdmin } = await supabase.rpc('fdgolf_is_admin')
  if (!isAdmin) return { error: 'Unauthorized.' }

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('status')
    .eq('id', tournamentId)
    .single()

  if (!tournament) return { error: 'Tournament not found.' }

  const expectedNext = VALID_TRANSITIONS[tournament.status]
  if (expectedNext !== targetStatus) {
    return { error: `Cannot transition from "${tournament.status}" to "${targetStatus}".` }
  }

  // Re-run blocking checks server-side for transitions that require them
  if (targetStatus === 'registration_open' || targetStatus === 'active') {
    const result = await getPreflightChecks(tournamentId, targetStatus)
    const failed = result.checks.filter((c) => !c.advisory && !c.passed)
    if (failed.length > 0) {
      return { error: `Pre-flight checks failed: ${failed.map((c) => c.label).join(', ')}.` }
    }
  }

  const { error: updateError } = await supabase
    .from('tournaments')
    .update({ status: targetStatus })
    .eq('id', tournamentId)

  if (updateError) return { error: updateError.message }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  await supabase.from('tournament_transitions').insert({
    tournament_id: tournamentId,
    from_status: tournament.status,
    to_status: targetStatus,
    changed_by: user!.id,
  })

  return { error: null }
}
