import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { getOwnedRecord } from "@/lib/supabase/ownership"
import { startRun } from "@/lib/scheduler/dispatch"
import { reconcilePaidWork } from "@/lib/recovery/paid"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"

export const dynamic = "force-dynamic"

/** PATCH /api/invoices/[id] — mark paid or update status/amount rows */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { user, error } = await requireUser()
  if (error) return error

  const rl = await rateLimit(`invoices-patch:${user!.id}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }) }
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })

  const owned = await getOwnedRecord<{ id: string; amount_cents: number | null; paid_cents: number | null }>(
    supabase,
    "invoices",
    params.id,
    user!.id,
    "id, amount_cents, paid_cents",
  )
  if (!owned.ok) {
    if (owned.reason === "db_error") {
      return NextResponse.json({ ok: false, error: "couldn't load invoice" }, { status: 500 })
    }
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 })
  }
  const invoice = owned.record

  const patch: Record<string, unknown> = {}
  const VALID_STATUSES = ["pending", "sent", "overdue", "paid", "partially_paid"]

  if (body.payment_url !== undefined) {
    const rawPay = String(body.payment_url ?? "").trim().slice(0, 500)
    patch.payment_url = rawPay && /^https?:\/\//i.test(rawPay) ? rawPay : null
  }

  // Manual pause/resume of follow-ups: flips queued runs for this invoice.
  // Paused runs keep their schedule; resume re-queues them (overdue ones fire
  // on the next dispatch). Returns counts so the UI can confirm.
  if (body.pause_runs === true || body.resume_runs === true) {
    const to = body.pause_runs === true ? "paused" : "queued"
    const from = body.pause_runs === true ? "queued" : "paused"
    const { data: flipped, error: runError } = await supabase
      .from("runs")
      .update({ status: to, updated_at: new Date().toISOString() })
      .eq("invoice_id", params.id)
      .eq("user_id", user!.id)
      .eq("status", from)
      .select("id")
    if (runError) return NextResponse.json({ ok: false, error: "couldn't update reminders" }, { status: 503 })
    return NextResponse.json({ ok: true, runs: Array.isArray(flipped) ? flipped.length : 0 })
  }

  const markPaid = body.mark_paid === true || body.status === "paid"
  if (markPaid) {
    patch.status = "paid"
    // (D19) A manual "mark paid" without an explicit partial amount means the
    // whole balance cleared — that's what the invoices table shows the owner.
    // A paid invoice must reconcile to its full amount; partial payments use
    // the explicit partially_paid state below.
    const amountCents = Number(invoice?.amount_cents ?? 0)
    if (body.paid_cents !== undefined) {
      const paidCents = Number(body.paid_cents)
      if (!Number.isFinite(paidCents) || Math.round(paidCents) !== amountCents) {
        return NextResponse.json({ ok: false, error: "paid invoices require paid_cents to equal the invoice total" }, { status: 400 })
      }
    }
    patch.paid_cents = amountCents
    patch.paid_at = new Date().toISOString()
  } else if (body.status) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ ok: false, error: `invalid status — must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 })
    }
    patch.status = body.status
    if (body.status === "partially_paid") {
      const amountCents = Number(invoice.amount_cents ?? 0)
      const paidCents = Number(body.paid_cents)
      if (!Number.isFinite(paidCents) || paidCents <= 0 || paidCents >= amountCents) {
        return NextResponse.json({ ok: false, error: "partially_paid requires paid_cents between 1 and the invoice total" }, { status: 400 })
      }
      patch.paid_cents = Math.round(paidCents)
      patch.paid_at = null
    } else {
      patch.paid_at = null
      if (body.paid_cents !== undefined) {
        const paidCents = Number(body.paid_cents)
        if (!Number.isFinite(paidCents) || paidCents < 0 || paidCents > Number(invoice.amount_cents ?? 0)) {
          return NextResponse.json({ ok: false, error: "paid_cents is outside the invoice total" }, { status: 400 })
        }
        patch.paid_cents = Math.round(paidCents)
      }
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "nothing to update" }, { status: 400 })
  }

  const { error: updErr } = await supabase
    .from("invoices")
    .update(patch)
    .eq("id", params.id)
    .eq("user_id", user!.id)
  if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 })

  // (D19/paid.ts) Reconciliation: marking paid stops the chase and settles
  // anything that was pending resolution for this invoice, so the ledger, the
  // ladder, the settlement offer and any open dispute all agree.
  if (markPaid) {
    await reconcilePaidWork(supabase, { userId: user!.id, invoiceId: params.id, source: "manual_mark_paid" })
  }

  return NextResponse.json({ ok: true })
}

/** POST /api/invoices/[id]/sequence?sequenceId=… — attach a ladder & start run */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { user, error } = await requireUser()
  if (error) return error

  let postBody: any
  try { postBody = await request.json() } catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }) }
  const sequenceId = String(postBody.sequenceId ?? "").slice(0, 45)
  if (!sequenceId) return NextResponse.json({ ok: false, error: "sequenceId required" }, { status: 400 })

  const res = await startRun({ userId: user!.id, sequenceId, invoiceId: params.id })
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 })

  return NextResponse.json({ ok: true })
}
