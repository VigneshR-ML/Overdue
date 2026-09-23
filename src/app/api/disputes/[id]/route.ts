import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedRecord } from "@/lib/supabase/ownership";
import { requireWorkspaceRole } from "@/lib/supabase/workspace-guard";
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

export const dynamic = "force-dynamic";

const OUTCOMES = ["resolved", "withdrawn", "credit_issued", "invoice_corrected"] as const;

/**
 * Owner dispute resolution — closes the dead-end.
 * PATCH { outcome: resolved|withdrawn|credit_issued|invoice_corrected, note? }
 * Resumes ladder explicitly, or cancels invoice chase on credit/correction.
 */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { user, error } = await requireUser();
  if (error) return error;
  const rl = await rateLimit(`dispute:${user!.id}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "Rate limit exceeded" }, { status: 429 });
  let body: { outcome?: string; note?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
  if (!OUTCOMES.includes(body.outcome as (typeof OUTCOMES)[number])) {
    return NextResponse.json({ ok: false, error: `outcome must be ${OUTCOMES.join("|")}` }, { status: 400 });
  }
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 });
  const owned = await getOwnedRecord<{ id: string; invoice_id: string; workspace_id: string | null }>(supabase, "disputes", params.id, user!.id, "id, invoice_id, workspace_id");
  if (!owned.ok) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  const gate = await requireWorkspaceRole(supabase, user!.id, (owned.record as { workspace_id?: string | null }).workspace_id ?? null, "admin");
  if (!gate.ok) return NextResponse.json({ ok: false, error: "forbidden — admin role required" }, { status: 403 });
  const now = new Date().toISOString();
  await supabase.from("disputes").update({ status: "resolved", resolved_at: now, outcome: body.outcome, resolved_note: String(body.note ?? "").slice(0, 500) }).eq("id", params.id);
  if (body.outcome === "resolved" || body.outcome === "withdrawn") {
    const resumeAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    await supabase.from("runs").update({ status: "queued", next_run_at: resumeAt, updated_at: now })
      .eq("invoice_id", owned.record.invoice_id).eq("user_id", user!.id).eq("status", "paused");
  } else {
    await supabase.from("runs").update({ status: "cancelled", updated_at: now })
      .eq("invoice_id", owned.record.invoice_id).eq("user_id", user!.id).in("status", ["queued", "paused", "processing", "sent"]);
  }
  try {
    await (supabase.from("workflow_events") as unknown as { insert: (r: unknown) => Promise<unknown> }).insert({
      user_id: user!.id, invoice_id: owned.record.invoice_id, event_type: "dispute_resolved",
      actor_type: "owner", payload: { dispute_id: params.id, outcome: body.outcome, note: String(body.note ?? "").slice(0, 500) },
    });
  } catch { /* pre-migration */ }
  return NextResponse.json({ ok: true, outcome: body.outcome });
}
