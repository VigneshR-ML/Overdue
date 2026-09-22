import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendRunNow } from "@/lib/scheduler/dispatch"
import { verifyEmailPreview } from "@/lib/scheduler/email-preview"
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

  let body: { confirmed?: unknown; previewToken?: unknown } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    // An empty body is treated as unconfirmed, not malformed.
  }
  if (body.confirmed !== true || typeof body.previewToken !== "string") {
    return NextResponse.json(
      { ok: false, error: "Preview the complete email before confirming the send." },
      { status: 400 },
    )
  }

  let preview
  try {
    preview = verifyEmailPreview(body.previewToken)
  } catch {
    return NextResponse.json({ ok: false, error: "Email confirmation is not configured on this deployment." }, { status: 500 })
  }
  if (!preview || preview.userId !== user!.id || preview.invoiceId !== params.id) {
    return NextResponse.json(
      { ok: false, error: "This email preview expired or no longer matches the invoice. Review it again before sending." },
      { status: 409 },
    )
  }

  const res = await sendRunNow(user!.id, preview.runId, {
    step: preview.step,
    subject: preview.subject,
    body: preview.body,
    offerId: preview.offerId,
  })
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
