import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { attachDefaultRuns, sendRunNow } from "@/lib/scheduler/dispatch"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"

export const dynamic = "force-dynamic"

/**
 * POST /api/invoices/[id]/send — manual "Send now". Executes the invoice's
 * current ladder step immediately. This is how Free plans send (autopilot is
 * Pro); Pro users can also force a step early from here.
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { user, error } = await requireUser()
  if (error) return error

  const rl = await rateLimit(`send:${user!.id}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user!.id)
    .single()
  if (!invoice) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 })

  let body: { confirmed?: unknown } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    // An empty body is treated as unconfirmed, not malformed.
  }
  if (body.confirmed !== true) {
    return NextResponse.json(
      { ok: false, error: "Review the recipient and reminder details before confirming the send." },
      { status: 400 },
    )
  }

  let { data: run } = await supabase
    .from("runs")
    .select("id")
    .eq("invoice_id", params.id)
    .eq("user_id", user!.id)
    .in("status", ["queued", "paused", "failed"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  // Repair older/imported invoices that pre-date automatic ladder attachment.
  if (!run) {
    await attachDefaultRuns(user!.id)
    const retry = await supabase
      .from("runs")
      .select("id")
      .eq("invoice_id", params.id)
      .eq("user_id", user!.id)
      .in("status", ["queued", "paused", "failed"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    run = retry.data
  }
  if (!run) {
    return NextResponse.json(
      { ok: false, error: "No active ladder is attached. Create or activate a default ladder, then return here." },
      { status: 400 },
    )
  }

  const res = await sendRunNow(user!.id, (run as { id: string }).id)
  if (!res.ok) {
    const raw = res.error ?? "send failed"
    const friendly = /RESEND_API_KEY|RESEND_FROM_EMAIL|mail backend unavailable/i.test(raw)
      ? "Email delivery is not configured yet. Add the verified Resend sender and API key, then try again."
      : /no recipient email/i.test(raw)
        ? "Add a client email address before sending this reminder."
        : raw
    return NextResponse.json({ ok: false, error: friendly }, { status: 400 })
  }
  return NextResponse.json({ ok: true, result: res.result })
}
