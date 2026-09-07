import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export type User = { id: string; email: string | null }

/**
 * Resolves the session user for a Route Handler. Returns a 401 response when
 * unauthenticated, so callers can do:
 *   const { user, error } = await requireUser(); if (error) return error;
 */
export async function requireUser(): Promise<{ user: User | null; error: NextResponse | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    return { user: null, error: NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 }) }
  }
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { user: null, error: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) }
  }
  return { user: { id: user.id, email: user.email ?? null }, error: null }
}