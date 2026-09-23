import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnedRecord } from "@/lib/supabase/ownership";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * Renewable debtor portal session — fixes one-time/short-lived link gap.
 * POST { invoiceId, planId?, email?, reason? } -> { token, expiresAt }
 * Stores hashed token; supports "send fresh link" via outbox.
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  let body: { invoiceId?: string; planId?: string | null; email?: string; reason?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
  if (!body.invoiceId) return NextResponse.json({ ok: false, error: "invoiceId required" }, { status: 400 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 });
  const owned = await getOwnedRecord<{ id: string }>(supabase, "invoices", body.invoiceId, user!.id, "id");
  if (!owned.ok) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  const raw = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
  const { error: insErr } = await supabase.from("debtor_portal_sessions").insert({
    invoice_id: body.invoiceId, plan_id: body.planId ?? null, token_hash: hash,
    issued_to_email: body.email ?? null, expires_at: expiresAt,
    issued_reason: body.reason === "fresh_link" ? "fresh_link" : body.planId ? "plan_portal" : "resolve_link",
  });
  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  try {
    await (supabase.from("workflow_events") as unknown as { insert: (r: unknown) => Promise<unknown> }).insert({
      user_id: user!.id, invoice_id: body.invoiceId, plan_id: body.planId ?? null,
      event_type: "portal_link_renewed", actor_type: "owner", payload: { expires_at: expiresAt },
    });
    await (supabase.from("outbox_jobs") as unknown as { insert: (r: unknown) => Promise<unknown> }).insert({
      job_type: "email", payload: { kind: "fresh_link", invoice_id: body.invoiceId, plan_id: body.planId ?? null, expires_at: expiresAt }, run_after: new Date().toISOString(),
    });
  } catch { /* ignore */ }
  return NextResponse.json({ ok: true, token: raw, expiresAt });
}
