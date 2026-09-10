import { createClient } from "@/lib/supabase/server"

export type Plan = "free" | "pro"

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
export async function getPlan(userId: string): Promise<Plan> {
  const supabase = createClient()
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", userId)
    .maybeSingle()
  if (!data) return "free"
  if (data.status === "cancelled" || data.status === "past_due") return "free"
  return data.plan === "pro" ? "pro" : "free"
}

/** Counts rows in a table for a user, for quota checks. */
export async function countForUser(
  userId: string,
  table: "clients" | "sequences" | "invoices",
): Promise<number> {
  const supabase = createClient()
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
  return count ?? 0
}
