import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedRecord } from "@/lib/supabase/ownership";
import { requireWorkspaceRole } from "@/lib/supabase/workspace-guard";

export const dynamic = "force-dynamic";

/** Owner-only plan cancellation. Debtor acceptance/decline must use the signed
 * resolution link so an owner session can never impersonate the debtor. */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { user, error } = await requireUser();
  if (error) return error;
  let body: { action?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
  if (body.action !== "owner_cancel") {
    return NextResponse.json({ ok: false, error: "debtor decisions must be made from the signed payment-plan link" }, { status: 400 });
  }
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 });
  const owned = await getOwnedRecord<{ id: string; invoice_id: string; user_id: string; workspace_id: string | null; status: string }>(
    supabase, "payment_plans", params.id, user!.id, "id, invoice_id, user_id, workspace_id, status",
  );
  if (!owned.ok) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  const plan = owned.record;
  const gate = await requireWorkspaceRole(supabase, user!.id, plan.workspace_id, "admin");
  if (!gate.ok) return NextResponse.json({ ok: false, error: "admin role required" }, { status: 403 });
  if (!["active", "delinquent", "proposed"].includes(plan.status)) return NextResponse.json({ ok: false, error: "cannot cancel in this state" }, { status: 409 });

  const now = new Date().toISOString();
  const resumeAt = new Date(Date.now() + 24 * 3600000).toISOString();
  await supabase.from("payment_plans").update({
    status: "cancelled", cancellation_reason: "owner_cancelled", updated_at: now,
  }).eq("id", plan.id).in("status", ["active", "delinquent", "proposed"]);
  await supabase.from("plan_installments").update({ status: "cancelled" })
    .eq("payment_plan_id", plan.id).in("status", ["scheduled", "due", "overdue", "partially_paid"]);
  await supabase.from("runs").update({ status: "queued", next_run_at: resumeAt, updated_at: now })
    .eq("invoice_id", plan.invoice_id).eq("user_id", plan.user_id).eq("status", "paused");
  await supabase.from("settlement_offers").update({ status: "sent", suspended_reason: null, updated_at: now })
    .eq("invoice_id", plan.invoice_id).eq("user_id", plan.user_id).eq("status", "suspended");
  await supabase.from("workflow_events").insert({
    workspace_id: plan.workspace_id, user_id: user!.id, invoice_id: plan.invoice_id, plan_id: plan.id,
    event_type: "plan_cancelled", actor_type: "owner", payload: { reason: "owner_cancelled", resume_at: resumeAt },
  });
  await supabase.from("outbox_jobs").insert({
    job_type: "email", payload: { kind: "cancellation", plan_id: plan.id, invoice_id: plan.invoice_id }, run_after: now,
  });
  return NextResponse.json({ ok: true, status: "cancelled", resume_at: resumeAt });
}
