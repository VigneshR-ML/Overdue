import { createAdminClient } from "@/lib/supabase/admin"
import { planForSubscription } from "./entitlement"

export type { Plan } from "./entitlement"

// Re-exported here so existing server imports keep working; the canonical
// home is ./limits (client-safe, no next/headers in its graph).
export {
  FREE_CLIENT_LIMIT,
  FREE_SEQUENCE_LIMIT,
  FREE_INVOICE_LIMIT,
  FREE_AI_DRAFTS_PER_MONTH,
} from "./limits"

/**
 * Resolves the user's effective plan from their subscription row.
 */
export async function getPlan(userId: string): Promise<ReturnType<typeof planForSubscription>> {
  const supabase = createAdminClient()
  if (!supabase || !userId) return "free"
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return planForSubscription(data as Parameters<typeof planForSubscription>[0] | null)
}

/** Counts rows in a table for a user, for quota checks. */
export async function countForUser(
  userId: string,
  table: "clients" | "sequences" | "invoices",
): Promise<number> {
  const supabase = createAdminClient()
  if (!supabase || !userId) return 0
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
  return count ?? 0
}
