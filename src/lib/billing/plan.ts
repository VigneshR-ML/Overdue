import { createClient } from "@/lib/supabase/server"
import { isDemoMode } from "@/lib/demo/fixtures"

export type Plan = "free" | "pro"

export const FREE_CLIENT_LIMIT = 1
export const FREE_SEQUENCE_LIMIT = 1

/**
 * Resolves the user's effective plan. Demo mode is always Pro so every UI path
 * is explorable without a real subscription.
 */
export async function getPlan(userId: string): Promise<Plan> {
  if (isDemoMode()) return "pro"
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
  table: "clients" | "sequences",
): Promise<number> {
  const supabase = createClient()
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
  return count ?? 0
}
