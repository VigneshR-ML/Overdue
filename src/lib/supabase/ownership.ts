import type { SupabaseClient } from "@supabase/supabase-js"

export type OwnedRecordResult<T> =
  | { ok: true; record: T }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "db_error"; message: string }

/**
 * Verified ownership read for the service-role (RLS-bypassing) client.
 *
 * After 0019_api_write_boundary.sql the client (`authenticated`) role is locked
 * to selects + profile updates, so every by-id mutation runs through the admin
 * client. With RLS off the `user_id` predicate is the ONLY guard against
 * cross-tenant writes — call this BEFORE any `.update()` / `.delete()` that
 * targets `id`, and treat `ok:false` as your 404.
 */
export async function getOwnedRecord<T>(
  supabase: SupabaseClient,
  table: string,
  id: string,
  userId: string,
  columns = "*",
): Promise<OwnedRecordResult<T>> {
  if (!id.trim() || !userId.trim()) {
    return { ok: false, reason: "not_found" }
  }
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle()
  if (error) {
    return { ok: false, reason: "db_error", message: error.message || error.code || "ownership query failed" }
  }
  if (!data) return { ok: false, reason: "not_found" }
  return { ok: true, record: data as T }
}