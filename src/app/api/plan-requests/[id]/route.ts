import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedRecord } from "@/lib/supabase/ownership";
import { requireWorkspaceRole } from "@/lib/supabase/workspace-guard";
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Owner-only review of a payment-plan request (workspace session required).
 * PATCH { action: "decline" | "cancel" }
 * - decline: closed/owner_declined + resume ladder in 24h + polite debtor path via outbox
 * - cancel: closed/owner_cancelled (explicit owner_cancelled transition — fixes orphan enum)
 * Debtor withdraw lives on the token-authenticated portal route
 * (POST /api/r/[token]/resolve action=withdraw), not here — the debtor holds
 * no workspace role under the permission matrix.
 * Accept/convert happens via proposal API which creates payment_plans row;
 * this endpoint never marks converted without an active plan.
 */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { user, error } = await requireUser();
  if (error) return error;
  const rl = await rateLimit(`plan-review:${user!.id}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "Rate limit exceeded" }, { status: 429 });
  let body: { action?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
  if (!["decline", "cancel"].includes(String(body.action))) {
    return NextResponse.json({ ok: false, error: "action must be decline|cancel" }, { status: 400 });
  }
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 });
  const owned = await getOwnedRecord<{ id: string; invoice_id: string; workspace_id: string | null }>(supabase, "payment_plan_requests", params.id, user!.id, "id, invoice_id, workspace_id");
  if (!owned.ok) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  const gate = await requireWorkspaceRole(supabase, user!.id, owned.record.workspace_id ?? null, "admin");
  if (!gate.ok) return NextResponse.json({ ok: false, error: "forbidden — admin role required" }, { status: 403 });
  const closeReason = body.action === "decline" ? "owner_declined" : "owner_cancelled";
  const now = new Date().toISOString();
  const resumeAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  await supabase.from("payment_plan_requests").update({ status: "closed", close_reason: closeReason, decided_at: now }).eq("id", params.id);
  // Resume ladder after 24h at prior rung (not immediately).
  await supabase.from("runs").update({ status: "queued", next_run_at: resumeAt, updated_at: now })
    .eq("invoice_id", owned.record.invoice_id).eq("user_id", user!.id).eq("status", "paused");
  // Resume any suspended settlement so owner explicitly chooses next step.
  await supabase.from("settlement_offers").update({ status: "sent", suspended_reason: null, updated_at: now })
    .eq("invoice_id", owned.record.invoice_id).eq("user_id", user!.id).eq("status", "suspended");
  try {
    await (supabase.from("workflow_events") as unknown as { insert: (r: unknown) => Promise<unknown> }).insert({
      user_id: user!.id, invoice_id: owned.record.invoice_id, event_type: "plan_declined",
      actor_type: "owner", payload: { request_id: params.id, close_reason: closeReason, resume_at: resumeAt },
    });
    await (supabase.from("outbox_jobs") as unknown as { insert: (r: unknown) => Promise<unknown> }).insert({
      job_type: "email", payload: { kind: "cancellation", request_id: params.id, invoice_id: owned.record.invoice_id }, run_after: now,
    });
  } catch { /* pre-migration */ }
  return NextResponse.json({ ok: true, close_reason: closeReason, resume_at: resumeAt });
}
