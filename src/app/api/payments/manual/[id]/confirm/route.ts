import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceRole } from "@/lib/supabase/workspace-guard";
import { reconcileConfirmedPayment } from "@/lib/recovery/payment-ledger";
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;
  const rl = await rateLimit(
    `manual-payment-confirm:${user!.id}`,
    RATE_LIMITS.paymentApproval.limit,
    RATE_LIMITS.paymentApproval.windowMs,
  );
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "too many confirmation attempts" }, { status: 429 });
  }
  const { id } = await params;
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 });

  const { data: payment } = await supabase.from("payments")
    .select("id, user_id, invoice_id, amount_cents, workspace_id, status, source")
    .eq("id", id).in("source", ["manual", "bank_transfer"]).maybeSingle();
  if (!payment || payment.status !== "pending") return NextResponse.json({ ok: false, error: "pending manual payment not found" }, { status: 404 });
  if (!payment.workspace_id) return NextResponse.json({ ok: false, error: "payment needs a backfilled workspace before dual confirmation" }, { status: 409 });
  if (payment.user_id === user!.id) return NextResponse.json({ ok: false, error: "the creator cannot approve their own high-value payment" }, { status: 403 });

  const gate = await requireWorkspaceRole(supabase, user!.id, payment.workspace_id, "admin");
  if (!gate.ok) return NextResponse.json({ ok: false, error: "admin confirmation required" }, { status: 403 });
  const { data: member } = await supabase.from("workspace_members").select("id")
    .eq("workspace_id", payment.workspace_id).eq("user_id", user!.id).maybeSingle();
  if (!member?.id) return NextResponse.json({ ok: false, error: "workspace membership missing" }, { status: 403 });

  // One transaction flips the payment and stamps the approver, so the audit
  // record can no longer be lost between the two writes. Returns false when
  // the payment is no longer pending, preserving the previous 409 behaviour.
  const { data: confirmed, error: confirmErr } = await supabase.rpc(
    "confirm_manual_payment_approval",
    { p_payment_id: id, p_member_id: member.id, p_confirmer: user!.id },
  );
  if (confirmErr) {
    return NextResponse.json({ ok: false, error: `confirmation failed: ${confirmErr.message}` }, { status: 409 });
  }
  if (!confirmed) return NextResponse.json({ ok: false, error: "payment was already confirmed or changed" }, { status: 409 });

  const reconciled = await reconcileConfirmedPayment(supabase, id);
  if (!reconciled.ok) return NextResponse.json({ ok: false, error: `payment confirmed but reconciliation failed: ${reconciled.error}` }, { status: 503 });

  await supabase.from("workflow_events").insert({
    workspace_id: payment.workspace_id,
    user_id: user!.id,
    invoice_id: payment.invoice_id,
    event_type: "manual_payment_recorded",
    actor_type: "owner",
    payload: { payment_id: id, confirmed_by: user!.id, dual_control: true },
  });
  return NextResponse.json({
    ok: true,
    status: reconciled.result.fully_paid ? "paid" : "partially_paid",
    paid_cents: reconciled.result.applied_cents,
  });
}
