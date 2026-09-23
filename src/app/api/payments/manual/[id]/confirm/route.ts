import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceRole } from "@/lib/supabase/workspace-guard";
import { reconcilePaidWork } from "@/lib/recovery/paid";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;
  const { id } = await params;
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 });

  const { data: payment } = await supabase.from("payments")
    .select("id, user_id, invoice_id, amount_cents, workspace_id, status")
    .eq("id", id).eq("source", "manual").maybeSingle();
  if (!payment || payment.status !== "pending") return NextResponse.json({ ok: false, error: "pending manual payment not found" }, { status: 404 });
  if (payment.user_id === user!.id) return NextResponse.json({ ok: false, error: "the creator cannot approve their own high-value payment" }, { status: 403 });
  const gate = await requireWorkspaceRole(supabase, user!.id, payment.workspace_id, "admin");
  if (!gate.ok) return NextResponse.json({ ok: false, error: "admin confirmation required" }, { status: 403 });

  const now = new Date().toISOString();
  const { data: confirmed } = await supabase.from("payments").update({
    status: "confirmed", recorded_by_member_id: user!.id, paid_at: now,
  }).eq("id", id).eq("status", "pending").select("id, invoice_id, amount_cents").maybeSingle();
  if (!confirmed) return NextResponse.json({ ok: false, error: "payment was already confirmed or changed" }, { status: 409 });
  await supabase.from("manual_payment_approvals").update({ confirmed_by: user!.id }).eq("payment_id", id);
  const { data: invoice } = await supabase.from("invoices").select("amount_cents, paid_cents").eq("id", confirmed.invoice_id).maybeSingle();
  const nextPaid = Number(invoice?.paid_cents ?? 0) + Number(confirmed.amount_cents);
  const complete = nextPaid >= Number(invoice?.amount_cents ?? 0);
  const invoiceUpdate = await supabase.from("invoices").update({
    paid_cents: nextPaid, status: complete ? "paid" : "partially_paid", paid_at: complete ? now : null, updated_at: now,
  }).eq("id", confirmed.invoice_id);
  if (invoiceUpdate.error) return NextResponse.json({ ok: false, error: "payment confirmed but invoice reconciliation failed" }, { status: 503 });
  if (complete) await reconcilePaidWork(supabase, { userId: payment.user_id, invoiceId: confirmed.invoice_id, source: "manual:dual_control" });
  await supabase.from("workflow_events").insert({
    user_id: user!.id, invoice_id: confirmed.invoice_id, event_type: "manual_payment_recorded",
    actor_type: "owner", payload: { payment_id: id, confirmed_by: user!.id, dual_control: true },
  });
  return NextResponse.json({ ok: true, status: complete ? "paid" : "partially_paid", paid_cents: nextPaid });
}
