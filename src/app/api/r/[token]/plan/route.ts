import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyResolutionToken } from "@/lib/recovery/token";
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Debtors do not have owner sessions. Plan acceptance therefore uses the same
 * signed resolution token as the request, but verifies the proposed plan is
 * attached to that exact invoice/request before activating it.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rl = await rateLimit(`plan-token:${request.headers.get("x-forwarded-for") ?? "anon"}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "Too many attempts. Try again later." }, { status: 429 });
  const verified = verifyResolutionToken(token);
  if (!verified) return NextResponse.json({ ok: false, error: "invalid link" }, { status: 404 });
  let body: { planId?: unknown; action?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }); }
  if (body.action !== "accept" && body.action !== "decline") return NextResponse.json({ ok: false, error: "action must be accept or decline" }, { status: 400 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "service unavailable" }, { status: 503 });

  const { data: offer } = await supabase.from("settlement_offers").select("id, user_id, invoice_id, expires_at").eq("id", verified.offerId).maybeSingle();
  if (!offer || new Date(offer.expires_at).getTime() <= Date.now()) return NextResponse.json({ ok: false, error: "resolution link expired; ask the business for a fresh link" }, { status: 410 });
  const planId = String(body.planId ?? "");
  const { data: plan } = await supabase.from("payment_plans").select("id, request_id, status, invoice_id").eq("id", planId).eq("invoice_id", offer.invoice_id).maybeSingle();
  if (!plan || plan.status !== "proposed") return NextResponse.json({ ok: false, error: "payment proposal is no longer available" }, { status: 409 });

  const now = new Date().toISOString();
  if (body.action === "decline") {
    await supabase.from("payment_plans").update({ status: "cancelled", cancellation_reason: "debtor_declined", updated_at: now }).eq("id", plan.id).eq("status", "proposed");
    if (plan.request_id) await supabase.from("payment_plan_requests").update({ status: "closed", close_reason: "debtor_withdrew", decided_at: now }).eq("id", plan.request_id);
    await supabase.from("runs").update({ status: "queued", next_run_at: new Date(Date.now() + 24 * 3600000).toISOString(), updated_at: now }).eq("invoice_id", offer.invoice_id).eq("user_id", offer.user_id).eq("status", "paused");
    return NextResponse.json({ ok: true, status: "declined" });
  }

  const { data: activated } = await supabase.from("payment_plans").update({ status: "active", updated_at: now }).eq("id", plan.id).eq("status", "proposed").select("id").maybeSingle();
  if (!activated) return NextResponse.json({ ok: false, error: "proposal changed; refresh and retry" }, { status: 409 });
  if (plan.request_id) await supabase.from("payment_plan_requests").update({ status: "converted", decided_at: now }).eq("id", plan.request_id);
  await supabase.from("workflow_events").insert({ user_id: offer.user_id, invoice_id: offer.invoice_id, plan_id: plan.id, event_type: "plan_accepted", actor_type: "debtor", payload: { plan_id: plan.id } });
  return NextResponse.json({ ok: true, status: "active" });
}
