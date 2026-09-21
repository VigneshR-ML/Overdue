"use client"

import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // OAuth and email callbacks are completed explicitly by
        // /auth/callback (or the root safety-net). Letting GoTrue also inspect
        // the URL races the manual PKCE exchange and can consume the one-time
        // code first, producing a false "code verifier not found" error after
        // Google has already authenticated the user.
        detectSessionInUrl: false,
      },
    },
  )
}
