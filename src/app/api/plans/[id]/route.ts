import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Plan transitions. converted is set ONLY here on debtor accept + active plan.
 * PATCH { action: "activate" | "debtor_accept" | "debtor_decline" | "owner_cancel" }
 * - debtor_accept: proposed->active, request under_review->converted
 * - debtor_decline: proposed->cancelled(debtor_declined), request back to under_review
 * - owner_cancel: active/delinquent->cancelled(owner_cancelled)
 */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { user, error } = await requireUser();
  if (error) return error;
  let body: { action?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 });
  const { data: plan } = await supabase.from("payment_plans").select("id, invoice_id, request_id, status").eq("id", params.id).eq("user_id", user!.id).maybeSingle();
  if (!plan) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  const now = new Date().toISOString();
  const p = plan as { id: string; invoice_id: string; request_id: string | null; status: string };

  if (body.action === "debtor_accept") {
    if (p.status !== "proposed") return NextResponse.json({ ok: false, error: "only proposed plans can be accepted" }, { status: 409 });
    await supabase.from("payment_plans").update({ status: "active", updated_at: now }).eq("id", p.id);
    if (p.request_id) await supabase.from("payment_plan_requests").update({ status: "converted", decided_at: now }).eq("id", p.request_id);
    try {
      await (supabase.from("workflow_events") as unknown as { insert: (r: unknown) => Promise<unknown> }).insert({
        user_id: user!.id, invoice_id: p.invoice_id, plan_id: p.id, event_type: "plan_accepted", actor_type: "debtor", payload: { plan_id: p.id },
      });
      await (supabase.from("outbox_jobs") as unknown as { insert: (r: unknown) => Promise<unknown> }).insert({
        job_type: "email", payload: { kind: "accepted", plan_id: p.id, invoice_id: p.invoice_id }, run_after: now,
      });
    } catch { /* pre-migration */ }
    return NextResponse.json({ ok: true, status: "active", request: "converted" });
  }
  if (body.action === "debtor_decline") {
    await supabase.from("payment_plans").update({ status: "cancelled", cancellation_reason: "debtor_declined", updated_at: now }).eq("id", p.id);
    if (p.request_id) await supabase.from("payment_plan_requests").update({ status: "under_review", decided_at: null }).eq("id", p.request_id);
    try {
      await (supabase.from("outbox_jobs") as unknown as { insert: (r: unknown) => Promise<unknown> }).insert({
        job_type: "email", payload: { kind: "cancellation", plan_id: p.id, invoice_id: p.invoice_id, reason: "debtor_declined" }, run_after: now,
      });
    } catch { /* pre-migration */ }
    return NextResponse.json({ ok: true, status: "cancelled" });
  }
  if (body.action === "owner_cancel") {
    if (!["active", "delinquent", "proposed"].includes(p.status)) return NextResponse.json({ ok: false, error: "cannot cancel in this state" }, { status: 409 });
    await supabase.from("payment_plans").update({ status: "cancelled", cancellation_reason: "owner_cancelled", updated_at: now }).eq("id", p.id);
    await supabase.from("plan_installments").update({ status: "cancelled" }).eq("payment_plan_id", p.id).in("status", ["scheduled", "due", "overdue", "partially_paid"]);
    try {
      await (supabase.from("outbox_jobs") as unknown as { insert: (r: unknown) => Promise<unknown> }).insert({
        job_type: "email", payload: { kind: "cancellation", plan_id: p.id, invoice_id: p.invoice_id, reason: "owner_cancelled" }, run_after: now,
      });
    } catch { /* pre-migration */ }
    return NextResponse.json({ ok: true, status: "cancelled" });
  }
  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}
