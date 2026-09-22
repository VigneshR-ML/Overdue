import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { attachDefaultRuns, previewRunEmail } from "@/lib/scheduler/dispatch"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"

export const dynamic = "force-dynamic"

/** Generates the exact email draft that must be confirmed before sending. */
export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const { user, error } = await requireUser()
  if (error) return error

  const rl = await rateLimit(`send-preview:${user!.id}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Too many previews. Try again shortly." }, { status: 429 })
  }

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 })
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id")
    .eq("id", id)
    .eq("user_id", user!.id)
    .maybeSingle()
  if (!invoice) return NextResponse.json({ ok: false, error: "Invoice not found." }, { status: 404 })

  let { data: run } = await supabase
    .from("runs")
    .select("id")
    .eq("invoice_id", id)
    .eq("user_id", user!.id)
    .in("status", ["queued", "paused", "failed"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!run) {
    await attachDefaultRuns(user!.id)
    const retry = await supabase
      .from("runs")
      .select("id")
      .eq("invoice_id", id)
      .eq("user_id", user!.id)
      .in("status", ["queued", "paused", "failed"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    run = retry.data
  }
  if (!run?.id) {
    return NextResponse.json(
      { ok: false, error: "No active ladder is attached. Create or activate a default ladder, then return here." },
      { status: 400 },
    )
  }

  const result = await previewRunEmail(user!.id, String(run.id))
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 409 })
  return NextResponse.json({ ok: true, preview: result.preview })
}

