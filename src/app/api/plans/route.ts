import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";
import { requireWorkspaceRole } from "@/lib/supabase/workspace-guard";
import { getOwnedRecord } from "@/lib/supabase/ownership";
import { buildDueDates, buildInstallments, lastDueDateExceedsDmax, splitEvenly, type PlanFrequency } from "@/lib/recovery/payment-plan";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  const rl = await rateLimit(`plans:${user!.id}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "Rate limit exceeded" }, { status: 429 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
  const requestId = String(body.requestId ?? "");
  const totalCents = Number(body.totalCents);
  const preferredCents = Number(body.preferredCents);
  const frequency = String(body.frequency ?? "monthly") as PlanFrequency;
  const startsOn = String(body.startsOn ?? "");
  if (!requestId || !Number.isFinite(totalCents) || totalCents <= 0 || !Number.isFinite(preferredCents) || preferredCents <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) {
    return NextResponse.json({ ok: false, error: "requestId, positive amounts, and startsOn (YYYY-MM-DD) are required" }, { status: 400 });
  }
  if (!["weekly", "biweekly", "monthly"].includes(frequency)) return NextResponse.json({ ok: false, error: "invalid frequency" }, { status: 400 });
  if (Date.parse(`${startsOn}T00:00:00Z`) < Date.now() - 24 * 60 * 60 * 1000) return NextResponse.json({ ok: false, error: "first payment date cannot be in the past" }, { status: 422 });

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 });
  const owned = await getOwnedRecord<{ id: string; user_id: string; invoice_id: string; status: string; workspace_id: string | null }>(
    supabase, "payment_plan_requests", requestId, user!.id, "id, user_id, invoice_id, status, workspace_id",
  );
  if (!owned.ok) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  const req = owned.record;
  if (!["submitted", "under_review"].includes(req.status)) {
    return NextResponse.json({ ok: false, error: "this request is already closed or converted" }, { status: 409 });
  }
  const gate = await requireWorkspaceRole(supabase, user!.id, req.workspace_id, "admin");
  if (!gate.ok) return NextResponse.json({ ok: false, error: "forbidden — admin role required" }, { status: 403 });

  const { data: invoice } = await supabase.from("invoices")
    .select("id, user_id, workspace_id, amount_cents, paid_cents, paid_at, status, currency")
    .eq("id", req.invoice_id).maybeSingle();
  if (!invoice || (req.workspace_id && invoice.workspace_id !== req.workspace_id)) return NextResponse.json({ ok: false, error: "invoice not found" }, { status: 404 });
  const outstandingCents = Math.max(0, Number(invoice.amount_cents) - Number(invoice.paid_cents));
  if (!outstandingCents || invoice.paid_at || invoice.status === "paid") return NextResponse.json({ ok: false, error: "invoice has no outstanding balance" }, { status: 409 });
  if (totalCents !== outstandingCents) return NextResponse.json({ ok: false, error: "totalCents must equal the current outstanding invoice balance" }, { status: 422 });

  const { data: settings } = req.workspace_id
    ? await supabase.from("payment_plan_settings").select("*").eq("workspace_id", req.workspace_id).maybeSingle()
    : { data: null };
  const s = (settings ?? {}) as { min_installment_cents?: number; max_installments?: number; max_duration_days?: number; proposal_expiry_days?: number; version?: number; timezone?: string; missed_before_delinquent?: number };
  const minCents = Number(s.min_installment_cents ?? 10000);
  const maxCount = Number(s.max_installments ?? 12);
  const maxDurationDays = Number(s.max_duration_days ?? 365);
  const proposalExpiryDays = Number(s.proposal_expiry_days ?? 7);
  if (![minCents, maxCount, maxDurationDays, proposalExpiryDays].every(Number.isFinite) || minCents <= 0 || maxCount < 2 || maxDurationDays < 1 || proposalExpiryDays < 1) {
    return NextResponse.json({ ok: false, error: "payment-plan settings are invalid" }, { status: 422 });
  }

  const result = buildInstallments({ totalCents, preferredCents, minCents, maxCount, maxDurationDays, frequency });
  if (result.kind === "no_plan") return NextResponse.json({ ok: false, error: result.reason }, { status: 422 });

  let finalCount = result.count;
  while (finalCount > 1 && lastDueDateExceedsDmax(startsOn, frequency, finalCount, maxDurationDays)) finalCount -= 1;
  if (finalCount < 2) {
    return NextResponse.json({ ok: false, error: "policy permits only a single payment; use direct payment or a settlement instead" }, { status: 422 });
  }
  const finalInstallments = finalCount === result.count ? result.installments : splitEvenly(totalCents, finalCount);
  if (Math.min(...finalInstallments) < minCents) {
    return NextResponse.json({ ok: false, error: "no plan meets the workspace minimum installment" }, { status: 422 });
  }

  const now = new Date().toISOString();
  const { data: prior } = await supabase.from("payment_plans").select("id, proposal_version")
    .eq("request_id", requestId).order("proposal_version", { ascending: false }).limit(1).maybeSingle();
  await supabase.from("payment_plans").update({
    status: "cancelled", cancellation_reason: "replaced", updated_at: now,
  }).eq("request_id", requestId).eq("status", "proposed");

  await supabase.from("settlement_offers").update({
    status: "suspended", suspended_reason: "plan_proposed", updated_at: now,
  }).eq("invoice_id", req.invoice_id).in("status", ["approved", "sent"]);

  const version = Number(prior?.proposal_version ?? 0) + 1;
  const expiresAt = new Date(Date.now() + proposalExpiryDays * 24 * 60 * 60 * 1000).toISOString();
  const { data: plan, error: planErr } = await supabase.from("payment_plans").insert({
    user_id: invoice.user_id,
    workspace_id: req.workspace_id,
    invoice_id: req.invoice_id,
    request_id: requestId,
    total_cents: outstandingCents,
    currency: String(invoice.currency ?? "USD").toUpperCase(),
    installment_count: finalCount,
    frequency,
    starts_on: startsOn,
    anchor_day: Number(startsOn.slice(8, 10)),
    status: "proposed",
    proposal_version: version,
    supersedes_plan_id: prior?.id ?? null,
    expires_at: expiresAt,
    policy_snapshot: {
      version: s.version ?? 1,
      min_installment_cents: minCents,
      max_installments: maxCount,
      max_duration_days: maxDurationDays,
      timezone: s.timezone ?? "UTC",
      missed_before_delinquent: s.missed_before_delinquent ?? 2,
    },
    is_counter_proposal: result.kind === "counter" || finalCount !== result.count,
    counter_reason: finalCount !== result.count ? "duration_adjusted" : result.counterReason,
    exceeds_debtor_preference: result.exceedsDebtorPreference || finalInstallments.some((amount) => amount > preferredCents),
  }).select("id").single();
  if (planErr || !plan) return NextResponse.json({ ok: false, error: planErr?.message ?? "could not create plan" }, { status: 500 });

  const dates = buildDueDates(startsOn, frequency, finalCount);
  const { error: installmentsError } = await supabase.from("plan_installments").insert(finalInstallments.map((amount_cents, index) => ({
    payment_plan_id: plan.id,
    workspace_id: req.workspace_id,
    sequence_no: index + 1,
    amount_cents,
    currency: String(invoice.currency ?? "USD").toUpperCase(),
    due_date: dates[index],
    status: "scheduled",
  })));
  if (installmentsError) return NextResponse.json({ ok: false, error: installmentsError.message }, { status: 500 });

  const disclosure = result.disclosure ?? (finalCount !== result.count
    ? "This schedule was adjusted to fit the maximum plan duration. Owner and debtor approval are required."
    : null);
  await supabase.from("workflow_events").insert({
    workspace_id: req.workspace_id,
    user_id: user!.id,
    invoice_id: req.invoice_id,
    plan_id: plan.id,
    event_type: "plan_proposed",
    actor_type: "owner",
    payload: { request_id: requestId, proposal_version: version, installments: finalInstallments, disclosure, expires_at: expiresAt },
  });
  await supabase.from("outbox_jobs").insert({
    job_type: "email",
    payload: { kind: prior?.id ? "revision" : "proposal", request_id: requestId, plan_id: plan.id, invoice_id: req.invoice_id, disclosure, dedupe_key: `proposal:${requestId}:${version}` },
    run_after: now,
  });

  return NextResponse.json({ ok: true, plan_id: plan.id, proposal_version: version, expires_at: expiresAt, kind: result.kind, installments: finalInstallments, disclosure, counterReason: result.counterReason });
}
