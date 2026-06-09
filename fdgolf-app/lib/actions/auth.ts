'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * loginAction — sign in with email + password.
 *
 * Returns { error: string } on failure so the Client Component can display
 * a message. On success, redirects to the `next` param (default `/`).
 * Error message is always generic to satisfy AC-0018.
 */
export async function loginAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const next = (formData.get('next') as string) || '/'

  const supabase = createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Never expose whether the email exists or the password is wrong (AC-0018)
    return { error: 'Invalid email or password' }
  }

  // redirect() throws internally — must NOT be inside try/catch
  redirect(next)
}

/**
 * logoutAction — sign out and redirect to /login.
 *
 * Called from a <form> with method="POST" (Server Action form pattern).
 * Satisfies AC-0020.
 */
export async function logoutAction(): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
