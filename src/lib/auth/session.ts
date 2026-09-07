import { isDemoMode, DEMO_USER } from "@/lib/demo/fixtures"
import { createClient } from "@/lib/supabase/server"

/**
 * Resolves the current session user for Server Components. Returns a stable
 * demo identity when Supabase isn't configured so the whole app is explorable
 * on localhost without any accounts. Returns null when unauthenticated.
 */
export async function getSessionUser(): Promise<{ id: string; email: string; isDemo: boolean } | null> {
  if (isDemoMode()) {
    return { id: DEMO_USER.id, email: DEMO_USER.email, isDemo: true }
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return { id: user.id, email: user.email ?? "", isDemo: false }
}