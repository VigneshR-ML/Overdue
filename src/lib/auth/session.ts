import { createClient } from "@/lib/supabase/server"

/**
 * Resolves the current session user for Server Components. Returns null when
 * unauthenticated.
 */
export async function getSessionUser(): Promise<{ id: string; email: string } | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return { id: user.id, email: user.email ?? "" }
}