import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedRecord } from "@/lib/supabase/ownership";
import { requireWorkspaceRole } from "@/lib/supabase/workspace-guard";
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";
import { reconcileConfirmedPayment } from "@/lib/recovery/payment-ledger";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  const rl = await rateLimit(`manual-pay:${user!.id}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "Rate limit exceeded" }, { status: 429 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
  const invoiceId = String(body.invoiceId ?? "");
  const amountCents = Number(body.amountCents);
  const source = String(body.source ?? "manual");
  const reference = String(body.reference ?? "").slice(0, 300);
  if (!invoiceId || !Number.isFinite(amountCents) || amountCents <= 0) return NextResponse.json({ ok: false, error: "invoiceId + amountCents>0 required" }, { status: 400 });
  if (!["manual", "bank_transfer"].includes(source)) return NextResponse.json({ ok: false, error: "source must be manual|bank_transfer" }, { status: 400 });
  if (!reference) return NextResponse.json({ ok: false, error: "reference/note required for audit" }, { status: 400 });
  if (body.confirm !== true) return NextResponse.json({ ok: false, error: "confirmation required", need_confirm: true }, { status: 422 });

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 });
  const owned = await getOwnedRecord<{ id: string; amount_cents: number; paid_cents?: number; status?: string; workspace_id: string | null; currency?: string | null }>(
    supabase, "invoices", invoiceId, user!.id, "id, amount_cents, paid_cents, status, workspace_id, currency",
  );
  if (!owned.ok) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  const gate = await requireWorkspaceRole(supabase, user!.id, owned.record.workspace_id ?? null, "admin");
  if (!gate.ok) return NextResponse.json({ ok: false, error: "forbidden — admin role required" }, { status: 403 });

  const currency = String(owned.record.currency ?? "USD").toUpperCase();
  if (body.currency && String(body.currency).toUpperCase() !== currency) {
    return NextResponse.json({ ok: false, error: `payment currency must match invoice currency (${currency})` }, { status: 422 });
  }
  const outstanding = Math.max(0, Number(owned.record.amount_cents) - Number(owned.record.paid_cents ?? 0));
  if (amountCents > outstanding) return NextResponse.json({ ok: false, error: "payment exceeds the remaining invoice balance" }, { status: 422 });

  let recordedByMemberId: string | null = null;
  if (owned.record.workspace_id) {
    const { data: member } = await supabase.from("workspace_members").select("id")
      .eq("workspace_id", owned.record.workspace_id).eq("user_id", user!.id).maybeSingle();
    if (!member?.id) return NextResponse.json({ ok: false, error: "workspace membership missing" }, { status: 403 });
    recordedByMemberId = member.id;
  }

  const threshold = Number(process.env.MANUAL_DUAL_CONTROL_THRESHOLD_CENTS ?? 50000);
  const needsSecondConfirmation = amountCents > threshold;
  if (needsSecondConfirmation && !owned.record.workspace_id) {
    return NextResponse.json({ ok: false, error: "high-value payments require a backfilled workspace before dual confirmation" }, { status: 409 });
  }
  const now = new Date().toISOString();
  const { data: payment, error: payErr } = await supabase.from("payments").insert({
    user_id: user!.id,
    workspace_id: owned.record.workspace_id,
    invoice_id: invoiceId,
    amount_cents: Math.round(amountCents),
    currency,
    source,
    status: needsSecondConfirmation ? "pending" : "confirmed",
    reference,
    recorded_by_member_id: recordedByMemberId,
    paid_at: now,
  }).select("id").single();
  if (payErr || !payment) return NextResponse.json({ ok: false, error: payErr?.message ?? "could not record payment" }, { status: 500 });

  await supabase.from("manual_payment_approvals").insert({
    payment_id: payment.id,
    created_by: user!.id,
    confirmed_by: needsSecondConfirmation ? null : user!.id,
    threshold_cents: threshold,
  });
  await supabase.from("workflow_events").insert({
    workspace_id: owned.record.workspace_id,
    user_id: user!.id,
    invoice_id: invoiceId,
    event_type: "manual_payment_recorded",
    actor_type: "owner",
    payload: { payment_id: payment.id, amount_cents: amountCents, source, reference, pending_confirmation: needsSecondConfirmation },
  });

  if (needsSecondConfirmation) {
    return NextResponse.json({ ok: true, pending_confirmation: true, payment_id: payment.id, message: "A second authenticated workspace admin must confirm this payment." });
  }
  const reconciled = await reconcileConfirmedPayment(supabase, payment.id);
  if (!reconciled.ok) return NextResponse.json({ ok: false, error: `payment recorded but reconciliation failed: ${reconciled.error}` }, { status: 503 });
  return NextResponse.json({
    ok: true,
    payment_id: payment.id,
    paid_cents: Number(owned.record.paid_cents ?? 0) + reconciled.result.applied_cents,
    status: reconciled.result.fully_paid ? "paid" : "partially_paid",
  });
}
