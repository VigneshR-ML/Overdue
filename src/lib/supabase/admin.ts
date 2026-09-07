import { createClient } from "@supabase/supabase-js"

/**
 * Plain Supabase client with the Service Role key. Server-only.
 * Used by webhooks, cron, and trusted server operations. NEVER import into
 * client components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}