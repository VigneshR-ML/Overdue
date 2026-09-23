import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceRole } from "@/lib/supabase/workspace-guard";
import { canAcceptTransfer, canInitiateTransfer } from "@/lib/supabase/workspace-team";
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Ownership transfer: owner-initiated, admin-accepted (never zero owners — DB trigger backs it).
 * POST { workspaceId, toUserId } — owner creates pending transfer.
 * PATCH { transferId, action: accept|decline } — target admin accepts (roles swapped atomically-ish).
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  const rl = await rateLimit(`transfer:${user!.id}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "Rate limit exceeded" }, { status: 429 });
  let body: { workspaceId?: string; toUserId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
  if (!body.workspaceId || !body.toUserId) return NextResponse.json({ ok: false, error: "workspaceId + toUserId required" }, { status: 400 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 });
  const gate = await requireWorkspaceRole(supabase, user!.id, body.workspaceId, "owner");
  if (!gate.ok) return NextResponse.json({ ok: false, error: "forbidden — owner role required" }, { status: 403 });
  const { data: target } = await supabase.from("workspace_members").select("role").eq("workspace_id", body.workspaceId).eq("user_id", body.toUserId).maybeSingle();
  const targetRole = (target as { role?: string } | null)?.role ?? null;
  const callerRole = (await requireWorkspaceRole(supabase, user!.id, body.workspaceId, "viewer")).role ?? null;
  if (!canInitiateTransfer(callerRole, targetRole)) {
    return NextResponse.json({ ok: false, error: "transfer requires owner caller + existing admin target" }, { status: 422 });
  }
  const { data, error: insErr } = await supabase.from("ownership_transfers").insert({
    workspace_id: body.workspaceId, from_user: user!.id, to_user: body.toUserId, status: "pending",
  }).select("id").single();
  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, transfer_id: (data as { id: string }).id });
}

export async function PATCH(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  let body: { transferId?: string; action?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
  if (!body.transferId || !["accept", "decline"].includes(String(body.action))) {
    return NextResponse.json({ ok: false, error: "transferId + action accept|decline required" }, { status: 400 });
  }
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 });
  const { data: t } = await supabase.from("ownership_transfers").select("id, workspace_id, from_user, to_user, status")
    .eq("id", body.transferId).maybeSingle();
  const tr = t as { id: string; workspace_id: string; from_user: string; to_user: string; status: string } | null;
  if (!tr || tr.status !== "pending") return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  if (!canAcceptTransfer(tr.status, user!.id, tr.to_user)) return NextResponse.json({ ok: false, error: "only the target admin may accept a pending transfer" }, { status: 403 });
  if (body.action === "decline") {
    await supabase.from("ownership_transfers").update({ status: "declined" }).eq("id", tr.id);
    return NextResponse.json({ ok: true, status: "declined" });
  }
  await supabase.from("workspace_members").update({ role: "owner" }).eq("workspace_id", tr.workspace_id).eq("user_id", tr.to_user);
  await supabase.from("workspace_members").update({ role: "admin" }).eq("workspace_id", tr.workspace_id).eq("user_id", tr.from_user);
  await supabase.from("ownership_transfers").update({ status: "accepted" }).eq("id", tr.id);
  try {
    await (supabase.from("workflow_events") as unknown as { insert: (r: unknown) => Promise<unknown> }).insert({
      workspace_id: tr.workspace_id, invoice_id: null, event_type: "ownership_transferred",
      actor_type: "owner", payload: { from: tr.from_user, to: tr.to_user },
    });
  } catch { /* ignore */ }
  return NextResponse.json({ ok: true, status: "accepted" });
}
