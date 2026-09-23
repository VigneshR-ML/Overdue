import type { SupabaseClient } from "@supabase/supabase-js"

export type OwnedRecordResult<T> =
  | { ok: true; record: T }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "db_error"; message: string }

/**
 * Returns a record owned by the current user or shared with one of their
 * workspaces. Owner-first preserves legacy rows; the membership branch enables
 * legitimate admin/member work without opening an unscoped service-role read.
 */
export async function getOwnedRecord<T>(
  supabase: SupabaseClient,
  table: string,
  id: string,
  userId: string,
  columns = "*",
): Promise<OwnedRecordResult<T>> {
  if (!id.trim() || !userId.trim()) return { ok: false, reason: "not_found" }

  const own = await supabase
    .from(table)
    .select(columns)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle()
  if (own.error) return { ok: false, reason: "db_error", message: own.error.message || own.error.code || "ownership query failed" }
  if (own.data) return { ok: true, record: own.data as T }

  const { data: memberships, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
  if (membershipError) return { ok: false, reason: "db_error", message: membershipError.message || "workspace lookup failed" }
  const workspaceIds = [...new Set((memberships ?? []).map((m: { workspace_id: string }) => m.workspace_id).filter(Boolean))]
  if (!workspaceIds.length) return { ok: false, reason: "not_found" }

  const shared = await supabase
    .from(table)
    .select(columns)
    .eq("id", id)
    .in("workspace_id", workspaceIds)
    .maybeSingle()
  if (shared.error) {
    // Some legacy tables do not have workspace_id. They are intentionally
    // owner-only until migrated, rather than becoming broadly accessible.
    if (/workspace_id|column/i.test(shared.error.message ?? "")) return { ok: false, reason: "not_found" }
    return { ok: false, reason: "db_error", message: shared.error.message || shared.error.code || "workspace ownership query failed" }
  }
  if (!shared.data) return { ok: false, reason: "not_found" }
  return { ok: true, record: shared.data as T }
}
