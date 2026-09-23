import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";
import { requireWorkspaceRole } from "@/lib/supabase/workspace-guard";
import { buildDueDates, buildInstallments, lastDueDateExceedsDmax, type PlanFrequency } from "@/lib/recovery/payment-plan";

export const dynamic = "force-dynamic";

/**
 * Owner creates an immutable proposal version from a plan request.
 * POST { requestId, totalCents, preferredCents, minCents?, maxCount?, maxDurationDays?, frequency, startsOn }
 * - Uses canonical algorithm with precedence (desired>allowed beats final<M).
 * - Stores policy_snapshot, proposal_version, supersedes chain, disclosure flags.
 * - Proposed/active plan blocks new settlements; request stays under_review.
 * - converted is set ONLY on debtor accept (see /api/plans/[id] accept), never here.
 */
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
  if (!requestId || !Number.isFinite(totalCents) || !Number.isFinite(preferredCents) || !/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) {
    return NextResponse.json({ ok: false, error: "requestId, totalCents, preferredCents, startsOn (YYYY-MM-DD) required" }, { status: 400 });
  }
  if (!["weekly", "biweekly", "monthly"].includes(frequency)) return NextResponse.json({ ok: false, error: "invalid frequency" }, { status: 400 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 });

  const { data: req } = await supabase.from("payment_plan_requests").select("id, user_id, invoice_id, status, workspace_id").eq("id", requestId).eq("user_id", user!.id).maybeSingle();
  if (!req) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  if (!["submitted", "under_review"].includes(String((req as { status: string }).status))) {
    return NextResponse.json({ ok: false, error: "this request is already closed or converted" }, { status: 409 });
  }
  if (preferredCents <= 0 || totalCents <= 0) {
    return NextResponse.json({ ok: false, error: "amounts must be greater than zero" }, { status: 422 });
  }
  const { data: invoice } = await supabase.from("invoices").select("id, amount_cents, paid_cents, paid_at, status, currency").eq("id", (req as { invoice_id: string }).invoice_id).eq("user_id", user!.id).maybeSingle();
  if (!invoice) return NextResponse.json({ ok: false, error: "invoice not found" }, { status: 404 });
  const outstandingCents = Math.max(0, Number(invoice.amount_cents) - Number(invoice.paid_cents));
  if (!outstandingCents || invoice.paid_at || invoice.status === "paid") return NextResponse.json({ ok: false, error: "invoice has no outstanding balance" }, { status: 409 });
  if (totalCents !== outstandingCents) return NextResponse.json({ ok: false, error: "totalCents must equal the current outstanding invoice balance" }, { status: 422 });
  // Workspace role enforcement (matrix: reviewPlan = admin+). Null workspace → owner fallback (single-user compat).
  const gate = await requireWorkspaceRole(supabase, user!.id, (req as { workspace_id?: string | null }).workspace_id ?? null, "admin");
  if (!gate.ok) return NextResponse.json({ ok: false, error: "forbidden — admin role required" }, { status: 403 });

  // Block if live settlement and no explicit suspension choice: suspend it here explicitly.
  await supabase.from("settlement_offers").update({ status: "suspended", suspended_reason: "plan_proposed", updated_at: new Date().toISOString() })
    .eq("invoice_id", (req as { invoice_id: string }).invoice_id).eq("user_id", user!.id).in("status", ["approved", "sent"]);

  const { data: settings } = await supabase.from("payment_plan_settings").select("*").eq("workspace_id", (req as { workspace_id?: string | null }).workspace_id ?? "").maybeSingle();
  const s = (settings ?? {}) as { min_installment_cents?: number; max_installments?: number; max_duration_days?: number; version?: number; timezone?: string };
  const minCents = Number(s.min_installment_cents ?? 10000);
  const maxCount = Number(s.max_installments ?? 12);
  const maxDurationDays = Number(s.max_duration_days ?? 365);

  const result = buildInstallments({ totalCents, preferredCents, minCents, maxCount, maxDurationDays, frequency });
  if (result.kind === "no_plan") return NextResponse.json({ ok: false, error: result.reason }, { status: 422 });
  // Calendar-accurate Dmax enforcement: shrink until real anchor_day dates fit.
  let finalCount = result.count;
  let finalInstallments = result.installments;
  while (finalCount > 1 && lastDueDateExceedsDmax(startsOn, frequency, finalCount, maxDurationDays)) {
    finalCount -= 1;
  }
  if (finalCount !== result.count) {
    const { splitEvenly } = await import("@/lib/recovery/payment-plan");
    finalInstallments = splitEvenly(totalCents, finalCount);
  }

  const { data: prior } = await supabase.from("payment_plans").select("id, proposal_version").eq("request_id", requestId).order("proposal_version", { ascending: false }).limit(1).maybeSingle();
  const version = Number((prior as { proposal_version?: number } | null)?.proposal_version ?? 0) + 1;
  const now = new Date().toISOString();
  const { data: plan, error: planErr } = await supabase.from("payment_plans").insert({
    user_id: user!.id, workspace_id: (req as { workspace_id?: string | null }).workspace_id ?? null,
    invoice_id: (req as { invoice_id: string }).invoice_id, request_id: requestId,
    total_cents: outstandingCents, currency: String(invoice.currency ?? "USD"), installment_count: finalCount,
    frequency, starts_on: startsOn, status: "proposed", proposal_version: version,
    supersedes_plan_id: (prior as { id?: string } | null)?.id ?? null,
    policy_snapshot: { version: s.version ?? 1, min_installment_cents: minCents, max_installments: maxCount, max_duration_days: maxDurationDays, timezone: s.timezone ?? "UTC" },
    is_counter_proposal: result.kind === "counter", counter_reason: result.counterReason,
    exceeds_debtor_preference: result.exceedsDebtorPreference,
  }).select("id").single();
  if (planErr || !plan) return NextResponse.json({ ok: false, error: planErr?.message ?? "could not create plan" }, { status: 500 });

  const dates = buildDueDates(startsOn, frequency, finalCount);
  const rows = finalInstallments.map((amount_cents, i) => ({
    payment_plan_id: (plan as { id: string }).id, workspace_id: (req as { workspace_id?: string | null }).workspace_id ?? null,
    sequence_no: i + 1, amount_cents, currency: String(invoice.currency ?? "USD"), due_date: dates[i], status: "scheduled",
  }));
  const { error: instErr } = await supabase.from("plan_installments").insert(rows);
  if (instErr) return NextResponse.json({ ok: false, error: instErr.message }, { status: 500 });

  try {
    await (supabase.from("workflow_events") as unknown as { insert: (r: unknown) => Promise<unknown> }).insert({
      user_id: user!.id, invoice_id: (req as { invoice_id: string }).invoice_id, plan_id: (plan as { id: string }).id,
      event_type: "plan_proposed", actor_type: "owner",
      payload: { request_id: requestId, proposal_version: version, installments: result.installments, disclosure: result.disclosure },
    });
    const dedupe = `${requestId}:${version}`;
    const emailKind = (prior as { id?: string } | null)?.id ? "revision" : "proposal";
    await (supabase.from("outbox_jobs") as unknown as { insert: (r: unknown) => Promise<unknown> }).insert({
      job_type: "email", payload: { kind: emailKind, request_id: requestId, plan_id: (plan as { id: string }).id, dedupe_key: dedupe, disclosure: result.disclosure }, run_after: now,
    });
    // Installment due/overdue/receipt emails are cron-owned (per-installment scheduler):
    // dispatcher queues kind=due|overdue|receipt on due dates from plan_installments.
    // See LLD §8; proposal/accepted/cancellation/revision/fresh_link are synchronous above.
  } catch { /* pre-migration */ }

  return NextResponse.json({ ok: true, plan_id: (plan as { id: string }).id, proposal_version: version, kind: result.kind, installments: finalInstallments, disclosure: result.disclosure, counterReason: result.counterReason });
}
