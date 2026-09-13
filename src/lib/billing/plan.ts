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
    .select("plan, status, current_period_end")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return "free"
  // Cancelled keeps Pro through the paid grace period (current_period_end in
  // the future); once expired/past that date it falls to free.
  if (data.status === "cancelled") {
    const end = (data as { current_period_end?: string | null }).current_period_end
    if (end && new Date(end).getTime() > Date.now()) {
      return (data as { plan?: string }).plan === "pro" ? "pro" : "free"
    }
    return "free"
  }
  // failed / expired revoke Pro outright.
  if (data.status === "failed" || data.status === "expired") return "free"
  // past_due / paused / on_hold keep Pro during the retry/grace window so a
  // failed renewal doesn't instantly lock users out; webhooks flip to free on
  // expiry/refund.
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
