import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

/**
 * Middleware — runs on every matched request.
 *
 * 1. Calls updateSession to refresh the Supabase auth token (AC-0021).
 * 2. Redirects unauthenticated requests for protected routes to /login.
 *
 * Protected routes (Phase 1): only /
 * Public routes: /login (always accessible)
 */
export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request)

  const { pathname } = request.nextUrl

  // Only protect the root route in Phase 1.
  // /login is always public. Static assets and _next are excluded by the matcher.
  const isProtected = pathname === '/'

  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url)
    // Preserve intended destination so post-login redirect works (AC-0017)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
