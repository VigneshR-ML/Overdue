import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createClient } from "@/lib/supabase/server"
import { attachDefaultRuns } from "@/lib/scheduler/dispatch"
import { getPlan, countForUser, FREE_CLIENT_LIMIT } from "@/lib/billing/plan"

export const dynamic = "force-dynamic"

/**
 * Create a manual invoice (provider = manual). Upserts a client, inserts the
 * invoice, then auto-attaches the default ladder if it's an open invoice.
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  const body = await request.json()
  const clientName = String(body.client_name ?? "Unknown client").slice(0, 120)
  const clientEmail = String(body.client_email ?? "").slice(0, 200)
  const number = String(body.number ?? "").slice(0, 80)
  const amountCents = Math.round(Number(body.amount_cents ?? 0))
  const currency = String(body.currency ?? "USD").toUpperCase().slice(0, 3)
  const dueDate = body.due_date ? String(body.due_date).slice(0, 10) : null

  if (amountCents <= 0) {
    return NextResponse.json({ ok: false, error: "amount must be positive" }, { status: 400 })
  }

  const supabase = createClient()
  const plan = await getPlan(user!.id)

  let clientId: string | null = null
  if (clientEmail) {
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", user!.id)
      .eq("billing_email", clientEmail)
      .maybeSingle()
    if (existing) {
      clientId = existing.id
    } else {
      // Free plan: only one client allowed.
      if (plan === "free" && (await countForUser(user!.id, "clients")) >= FREE_CLIENT_LIMIT) {
        return NextResponse.json(
          { ok: false, error: "Free plan is limited to 1 client — upgrade to Pro to add more." },
          { status: 403 },
        )
      }
      const { data: created, error: cErr } = await supabase
        .from("clients")
        .insert({ user_id: user!.id, name: clientName, billing_email: clientEmail, email: clientEmail })
        .select("id")
        .single()
      if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 400 })
      clientId = created.id
    }
  }

  const { data: invoice, error: iErr } = await supabase
    .from("invoices")
    .insert({
      user_id: user!.id,
      client_id: clientId,
      provider: "manual",
      provider_id: `manual-${number || crypto.randomUUID()}`,
      number: number || null,
      status: "sent",
      amount_cents: amountCents,
      paid_cents: 0,
      currency,
      due_date: dueDate,
      issue_date: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single()

  if (iErr) return NextResponse.json({ ok: false, error: iErr.message }, { status: 400 })

  await attachDefaultRuns(user!.id)
  return NextResponse.json({ ok: true, id: invoice.id })
}