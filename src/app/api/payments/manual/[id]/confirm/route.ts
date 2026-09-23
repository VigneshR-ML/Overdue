import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceRole } from "@/lib/supabase/workspace-guard";
import { reconcileConfirmedPayment } from "@/lib/recovery/payment-ledger";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;
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

  const now = new Date().toISOString();
  const { data: confirmed } = await supabase.from("payments").update({
    status: "confirmed", recorded_by_member_id: member.id, paid_at: now,
  }).eq("id", id).eq("status", "pending").select("id, invoice_id").maybeSingle();
  if (!confirmed) return NextResponse.json({ ok: false, error: "payment was already confirmed or changed" }, { status: 409 });

  await supabase.from("manual_payment_approvals").update({ confirmed_by: user!.id }).eq("payment_id", id);
  const reconciled = await reconcileConfirmedPayment(supabase, id);
  if (!reconciled.ok) return NextResponse.json({ ok: false, error: `payment confirmed but reconciliation failed: ${reconciled.error}` }, { status: 503 });

  await supabase.from("workflow_events").insert({
    workspace_id: payment.workspace_id,
    user_id: user!.id,
    invoice_id: confirmed.invoice_id,
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
