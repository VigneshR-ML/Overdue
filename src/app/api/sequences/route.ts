import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getPlan, countForUser, FREE_SEQUENCE_LIMIT } from "@/lib/billing/plan"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"
import type { SequenceStep } from "@/types"

export const dynamic = "force-dynamic"

/** GET /api/sequences → list user's sequences */
export async function GET() {
  const { user, error } = await requireUser()
  if (error) return error

  const supabase = createClient()
  const { data } = await supabase
    .from("sequences")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at")
  return NextResponse.json({ ok: true, sequences: data ?? [] })
}

/** POST /api/sequences → create (from scratch with steps) */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  const rl = rateLimit(`sequences:${user!.id}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }) }
  const name = String(body.name ?? "My ladder").slice(0, 80)
  const steps = (body.steps ?? []) as SequenceStep[]

  if (!steps.length) {
    return NextResponse.json({ ok: false, error: "a ladder needs at least one rung" }, { status: 400 })
  }

  const plan = await getPlan(user!.id)
  if (plan === "free" && (await countForUser(user!.id, "sequences")) >= FREE_SEQUENCE_LIMIT) {
    return NextResponse.json(
      { ok: false, error: "Free plan is limited to 1 ladder — upgrade to Pro to add more." },
      { status: 403 },
    )
  }

  const supabase = createClient()
  const { data, error: err } = await supabase
    .from("sequences")
    .insert({ user_id: user!.id, name, is_active: true, is_template: false, steps })
    .select("id")
    .single()

  if (err) return NextResponse.json({ ok: false, error: err.message }, { status: 400 })
  return NextResponse.json({ ok: true, id: data.id })
}

/** PUT /api/sequences → update name/active/steps */
export async function PUT(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }) }
  const id = String(body.id ?? "")
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 })

  const supabase = createClient()
  const patch: Record<string, unknown> = {}
  if (typeof body.name === "string") patch.name = body.name.slice(0, 80)
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active
  if (Array.isArray(body.steps)) {
    const VALID_TONES = ["gentle", "nudge", "firm", "final"]
    const cleaned = body.steps.map((s: any) => ({
      ...s,
      delay_days: Math.max(0, Number(s.delay_days ?? 1)),
      tone: VALID_TONES.includes(s.tone) ? s.tone : "nudge",
      step_order: Number(s.step_order ?? 0),
    }))
    patch.steps = cleaned
  }

  const { error: err } = await supabase
    .from("sequences")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user!.id)

  if (err) return NextResponse.json({ ok: false, error: err.message }, { status: 400 })

  // If activated, attach it to any open invoices that lack a run.
  if (body.is_active === true) {
    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ ok: true })
    const { startRun } = await import("@/lib/scheduler/dispatch")
    const { data: invoices } = await admin
      .from("invoices")
      .select("id, status, paid_cents, amount_cents, paid_at")
      .eq("user_id", user!.id)
      .in("status", ["pending", "sent", "overdue", "partially_paid"])
    for (const inv of invoices ?? []) {
      const amount = Number(inv.amount_cents ?? 0)
      const paid = Number(inv.paid_cents ?? 0)
      if (inv.paid_at || (inv.status === "paid" && amount > 0 && paid >= amount)) continue
      await startRun({ userId: user!.id, sequenceId: id, invoiceId: inv.id })
    }
  }

  return NextResponse.json({ ok: true })
}

/** DELETE /api/sequences?id=… */
export async function DELETE(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 })

  const supabase = createClient()
  const { data: seq, error: fetchErr } = await supabase
    .from("sequences")
    .select("is_default, is_template")
    .eq("id", id)
    .eq("user_id", user!.id)
    .single()
  if (fetchErr || !seq) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 })
  if (seq.is_default || seq.is_template) {
    return NextResponse.json({ ok: false, error: "defaults and templates stay" }, { status: 400 })
  }

  // Clean up orphaned runs for this sequence before deleting
  await supabase.from("runs").delete().eq("sequence_id", id).eq("user_id", user!.id)

  const { error: delErr } = await supabase.from("sequences").delete().eq("id", id).eq("user_id", user!.id)
  if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}