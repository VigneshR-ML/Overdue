import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { CookieOptions } from "@supabase/ssr"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return supabaseResponse

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthed = Boolean(user)
  const path = request.nextUrl.pathname
  const isAppRoute = path.startsWith("/dashboard") || path.startsWith("/invoices") || path.startsWith("/clients") || path.startsWith("/sequences") || path.startsWith("/insights") || path.startsWith("/settings")
  const isAuthPage = path.startsWith("/login") || path.startsWith("/signup")
  const isOnboarding = path.startsWith("/onboarding")

  if (isAppRoute && !isAuthed) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.searchParams.set("signin", "1")
    return NextResponse.redirect(url)
  }

  if (isAuthPage && isAuthed && !isOnboarding) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}