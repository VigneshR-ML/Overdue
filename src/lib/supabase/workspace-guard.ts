import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

const RANK: Record<WorkspaceRole, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };

/**
 * Workspace role guard — the actual enforcement behind the permission matrix.
 * Tenancy first, authorization second. Every caller MUST call getOwnedRecord
 * (eq id + eq user_id) BEFORE this guard, so the null-workspace owner fallback
 * below can only fire for a row the requesting user already owns — never as a
 * privilege grant to a stranger. The fallback exists solely for pre-migration
 * rows with NULL workspace_id (single-user compat); it does not bypass tenancy.
 * Once backfill is confirmed complete (scripts/check-workspace-backfill.sql returns
 * zero NULLs), replace the fallback with a hard fail and add NOT NULL constraints.
 * TRACKED FOLLOW-UP (post-launch, not indefinite): run `npm run db:backfill-check`
 * weekly until all zeros for 2 consecutive weeks, then remove this fallback.
 * TODO[post-launch]: hard-fail + NOT NULL workspace_id — see docs/LLD-detailed.md §8.
 */
export async function getWorkspaceRole(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string | null | undefined,
): Promise<WorkspaceRole | null> {
  if (!workspaceId) return "owner"; // pre-migration rows without workspace: owner fallback
  const { data } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  const role = (data as { role?: string } | null)?.role;
  return role === "owner" || role === "admin" || role === "member" || role === "viewer" ? role : null;
}

export function canAct(role: WorkspaceRole | null, minimum: WorkspaceRole): boolean {
  if (!role) return false;
  return RANK[role] >= RANK[minimum];
}

/** Minimum roles per HLD matrix */
export const POLICY = {
  view: "viewer",
  createInvoiceOrLadder: "member",
  sendReminder: "member",
  reviewPlan: "admin",
  settlement: "admin",
  manualPay: "admin",
  cancelPlan: "admin",
  manageTeam: "owner",
} as const satisfies Record<string, WorkspaceRole>;

export async function requireWorkspaceRole(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string | null | undefined,
  minimum: WorkspaceRole,
): Promise<{ ok: true; role: WorkspaceRole } | { ok: false; role: WorkspaceRole | null }> {
  const role = await getWorkspaceRole(supabase, userId, workspaceId).catch(() => null);
  if (!canAct(role, minimum)) return { ok: false, role };
  return { ok: true, role: role as WorkspaceRole };
}
