import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendRunNow } from "@/lib/scheduler/dispatch"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"

export const dynamic = "force-dynamic"

/**
 * POST /api/invoices/[id]/send — manual "Send now". Executes the invoice's
 * current ladder step immediately. This is how Free plans send (autopilot is
 * Pro); Pro users can also force a step early from here.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser()
  if (error) return error

  const rl = rateLimit(`send:${user!.id}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs)
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

  const { data: run } = await supabase
    .from("runs")
    .select("id")
    .eq("invoice_id", params.id)
    .eq("user_id", user!.id)
    .in("status", ["queued", "paused"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!run) {
    return NextResponse.json(
      { ok: false, error: "no scheduled follow-up — attach a ladder first" },
      { status: 400 },
    )
  }

  const res = await sendRunNow(user!.id, (run as { id: string }).id)
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 })
  return NextResponse.json({ ok: true, result: res.result })
}
