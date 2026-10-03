import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"
import { canonicalHost } from "@/lib/site-url"

const CANONICAL_HOST = canonicalHost()
const LEGACY_PATHS: Record<string, string> = {
  "/for-agencies": "/for/agencies",
  "/for-freelancers": "/for/freelancers",
}

/**
 * Force a single canonical origin in production. PKCE OAuth stores the code
 * verifier on the domain where the login started; if Supabase then returns the
 * user to a different domain, `exchangeCodeForSession` fails with "code
 * verifier not found". Redirecting every alternate host (overdue.vercel.app,
 * www.*, preview URLs) to the canonical host keeps start + finish on the same
 * domain so Google sign-in always completes.
 */
export async function proxy(request: NextRequest) {
  const host = request.nextUrl.host
  // Free-tools subdomain: serve the public calculators without auth redirects.
  // `tools.getoverdue.online/` shows the calculators hub and
  // `tools.getoverdue.online/<calculator-slug>` serves that calculator.
  // Requires DNS + Vercel domain config for `tools.*` (see docs); the main
  // domain keeps serving the same pages under /calculators as canonical.
  if (host.startsWith("tools.")) {
    const path = request.nextUrl.pathname
    if (
      !path.startsWith("/api/") &&
      !path.startsWith("/calculators") &&
      !path.startsWith("/auth/") &&
      path !== "/sitemap.xml" &&
      path !== "/robots.txt"
    ) {
      const url = request.nextUrl.clone()
      url.pathname = path === "/" ? "/calculators" : `/calculators${path}`
      return NextResponse.rewrite(url)
    }
    return updateSession(request)
  }
  const canonicalPath = LEGACY_PATHS[request.nextUrl.pathname]
  const shouldCanonicalizeHost =
    process.env.NODE_ENV !== "development" &&
    !host.startsWith("localhost") &&
    host !== "127.0.0.1" &&
    host !== CANONICAL_HOST &&
    !host.startsWith("tools.")

  if (shouldCanonicalizeHost || canonicalPath) {
    const path = request.nextUrl.pathname
    if (path.startsWith("/api/") || path.startsWith("/auth/callback")) {
      // Don't bounce API calls, and never bounce the OAuth callback: the PKCE
      // verifier lives on the origin where login started, so the callback must
      // finish there — only canonicalize browser-facing pages.
      return updateSession(request)
    }
    const url = request.nextUrl.clone()
    if (shouldCanonicalizeHost) {
      url.protocol = "https:"
      url.host = CANONICAL_HOST
    }
    if (canonicalPath) url.pathname = canonicalPath
    return NextResponse.redirect(url, { status: 308 })
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Run on everything except static assets and Next internals.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
