import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"
import { daysOverdue, recommendSettlement } from "@/lib/recovery/settlement"

export const dynamic = "force-dynamic"

/**
 * Recommend a settlement for one invoice. Read-only: no offer is created.
 * History comes from the client's observed payment behavior (avg days late);
 * open/dispute rates are unknown at this stage and left null.
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  const rl = await rateLimit(`settlement:${user!.id}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  let body: {
    invoiceId?: unknown
    minAcceptableCents?: unknown
    maxIncentiveBps?: unknown
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 })
  }
  if (typeof body.invoiceId !== "string" || !body.invoiceId) {
    return NextResponse.json({ ok: false, error: "invoiceId required" }, { status: 400 })
  }

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, amount_cents, paid_cents, currency, due_date, status, paid_at, client_id, number")
    .eq("id", body.invoiceId)
    .eq("user_id", user!.id)
    .single()
  if (!invoice) return NextResponse.json({ ok: false, error: "invoice not found" }, { status: 404 })
  if (invoice.status === "paid" || invoice.paid_at) {
    return NextResponse.json({ ok: false, error: "invoice already paid" }, { status: 400 })
  }

  const outstanding = Math.max(0, (invoice.amount_cents ?? 0) - (invoice.paid_cents ?? 0))
  if (outstanding <= 0) {
    return NextResponse.json({ ok: false, error: "no outstanding balance" }, { status: 400 })
  }

  let avgLateDays: number | null = null
  if (invoice.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("avg_payment_days")
      .eq("id", invoice.client_id)
      .eq("user_id", user!.id)
      .single()
    if (typeof client?.avg_payment_days === "number") avgLateDays = client.avg_payment_days
  }

  const minAcceptableCents =
    typeof body.minAcceptableCents === "number" && Number.isFinite(body.minAcceptableCents)
      ? Math.max(0, Math.round(body.minAcceptableCents))
      : null
  const maxIncentiveBps =
    typeof body.maxIncentiveBps === "number" && Number.isFinite(body.maxIncentiveBps)
      ? Math.max(0, Math.min(2000, Math.round(body.maxIncentiveBps)))
      : 500

  const result = recommendSettlement({
    outstandingCents: outstanding,
    daysOverdue: daysOverdue(invoice.due_date),
    history: { avgLateDays, openRate: null, disputeRate: null },
    minAcceptableCents,
    maxIncentiveBps,
  })

  return NextResponse.json({
    ok: true,
    invoice: {
      id: invoice.id,
      number: invoice.number,
      currency: invoice.currency,
      outstandingCents: outstanding,
      daysOverdue: daysOverdue(invoice.due_date),
    },
    ...result,
  })
}
