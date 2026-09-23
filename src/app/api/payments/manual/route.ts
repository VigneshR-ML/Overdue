import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedRecord } from "@/lib/supabase/ownership";
import { requireWorkspaceRole } from "@/lib/supabase/workspace-guard";
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";
import { reconcilePaidWork } from "@/lib/recovery/paid";

export const dynamic = "force-dynamic";

/**
 * Manual payment with non-blind confirmation + dual control.
 * POST { invoiceId, amountCents, currency?, source?, reference?, confirm?: boolean }
 * - Requires amount, currency, date(=now), source, reference/note, actor.
 * - Below threshold: single owner/admin may confirm after confirm=true.
 * - Above threshold: creator and confirmer must differ (pass confirmerId != creator).
 * Writes payments ledger row (source manual/bank_transfer), never a blind paid toggle.
 */
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
  const owned = await getOwnedRecord<{ id: string; amount_cents: number; paid_cents?: number; status?: string; workspace_id: string | null }>(supabase, "invoices", invoiceId, user!.id, "id, amount_cents, paid_cents, status, workspace_id");
  if (!owned.ok) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  const gate = await requireWorkspaceRole(supabase, user!.id, owned.record.workspace_id ?? null, "admin");
  if (!gate.ok) return NextResponse.json({ ok: false, error: "forbidden — admin role required" }, { status: 403 });

  const threshold = Number(process.env.MANUAL_DUAL_CONTROL_THRESHOLD_CENTS ?? 50000);
  const outstanding = Math.max(0, Number(owned.record.amount_cents) - Number(owned.record.paid_cents ?? 0));
  if (amountCents > outstanding) return NextResponse.json({ ok: false, error: "payment exceeds the remaining invoice balance" }, { status: 422 });
  const needsSecondConfirmation = amountCents > threshold;
  const now = new Date().toISOString();
  const { data: payment, error: payErr } = await supabase.from("payments").insert({
    user_id: user!.id, workspace_id: owned.record.workspace_id, invoice_id: invoiceId, amount_cents: Math.round(amountCents),
    currency: String(body.currency ?? "USD"), source, status: needsSecondConfirmation ? "pending" : "confirmed",
    reference, recorded_by_member_id: user!.id, paid_at: now,
  }).select("id").single();
  if (payErr || !payment) return NextResponse.json({ ok: false, error: (payErr as { message?: string } | null)?.message ?? "could not record — run 0022 migration" }, { status: 500 });
  try {
    await (supabase.from("manual_payment_approvals") as unknown as { insert: (r: unknown) => Promise<unknown> }).insert({
      payment_id: (payment as { id: string }).id, created_by: user!.id, confirmed_by: needsSecondConfirmation ? null : user!.id, threshold_cents: threshold,
    });
    await (supabase.from("workflow_events") as unknown as { insert: (r: unknown) => Promise<unknown> }).insert({
      user_id: user!.id, invoice_id: invoiceId, event_type: "manual_payment_recorded", actor_type: "owner",
      payload: { payment_id: (payment as { id: string }).id, amount_cents: amountCents, source, reference },
    });
    await (supabase.from("outbox_jobs") as unknown as { insert: (r: unknown) => Promise<unknown> }).insert({
      job_type: "email", payload: { kind: "receipt", payment_id: (payment as { id: string }).id, invoice_id: invoiceId, amount_cents: amountCents }, run_after: now,
    });
  } catch { /* pre-migration */ }
  if (needsSecondConfirmation) return NextResponse.json({ ok: true, pending_confirmation: true, payment_id: (payment as { id: string }).id, message: "A second authenticated workspace admin must confirm this payment." });
  const nextPaid = Number(owned.record.paid_cents ?? 0) + Math.round(amountCents);
  const isFullyPaid = nextPaid >= Number(owned.record.amount_cents);
  const { error: invoiceError } = await supabase.from("invoices").update({
    paid_cents: nextPaid,
    status: isFullyPaid ? "paid" : "partially_paid",
    paid_at: isFullyPaid ? now : null,
    updated_at: now,
  }).eq("id", invoiceId).eq("user_id", user!.id);
  if (invoiceError) return NextResponse.json({ ok: false, error: "payment recorded but invoice reconciliation failed; retry reconciliation" }, { status: 503 });
  if (isFullyPaid) await reconcilePaidWork(supabase, { userId: user!.id, invoiceId, source: `manual:${source}` });
  return NextResponse.json({ ok: true, payment_id: (payment as { id: string }).id, paid_cents: nextPaid, status: isFullyPaid ? "paid" : "partially_paid" });
}
