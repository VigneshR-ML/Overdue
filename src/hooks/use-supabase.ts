"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * Tiny client-side hook for "current user" state. We prefer server-side auth in
 * RSC pages; this is used only by client components that need an email/profile.
 */
export function useSupabaseUser() {
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
      setLoading(false)
    })
  }, [])

  return { email, loading }
}

export function useSupabaseOrNull() {
  const supabase = createClient()
  const configured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  return configured ? supabase : null
}