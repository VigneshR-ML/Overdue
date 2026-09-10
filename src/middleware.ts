import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

const CANONICAL_HOST = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://getoverdue.online"
).replace(/^https?:\/\//, "")
  .replace(/\/+$/, "")

/**
 * Force a single canonical origin in production. PKCE OAuth stores the code
 * verifier on the domain where the login started; if Supabase then returns the
 * user to a different domain, `exchangeCodeForSession` fails with "code
 * verifier not found". Redirecting every alternate host (overdue.vercel.app,
 * www.*, preview URLs) to the canonical host keeps start + finish on the same
 * domain so Google sign-in always completes.
 */
export async function middleware(request: NextRequest) {
  const host = request.nextUrl.host

  if (
    process.env.NODE_ENV !== "development" &&
    !host.startsWith("localhost") &&
    host !== CANONICAL_HOST
  ) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      // Don't bounce API calls; only canonicalize browser-facing pages.
      return updateSession(request)
    }
    const url = request.nextUrl.clone()
    url.protocol = "https:"
    url.host = CANONICAL_HOST
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