import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * updateSession — refreshes the Supabase auth session on every request.
 *
 * Must be called from the root middleware.ts. It re-creates the server client
 * with cookie read/write access via NextRequest/NextResponse, which causes
 * @supabase/ssr to automatically refresh expired tokens and write updated
 * session cookies back to the response. This satisfies AC-0021.
 *
 * IMPORTANT: cookies() from next/headers is NOT used here — NextRequest and
 * NextResponse provide cookies in middleware context (no async cookies()).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Refresh session — side effect writes updated cookies to response
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user }
}
