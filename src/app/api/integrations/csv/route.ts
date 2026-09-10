import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createClient } from "@/lib/supabase/server"
import { parseCsv } from "@/lib/integrations/csv"
import { attachDefaultRuns } from "@/lib/scheduler/dispatch"
import { getPlan, countForUser, FREE_CLIENT_LIMIT, FREE_INVOICE_LIMIT } from "@/lib/billing/plan"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  const csv = await request.text()
  const { invoices, errors } = parseCsv(csv)

  if (!invoices.length) {
    return NextResponse.json(
      { ok: false, error: errors[0] ?? "no rows parsed — check the headers" },
      { status: 400 },
    )
  }

  const supabase = createClient()
  const plan = await getPlan(user!.id)
  // Free plan: invoice cap applies to imports too (upgrade moment, not a wall).
  if (plan === "free") {
    const existingInvoices = await countForUser(user!.id, "invoices")
    const room = Math.max(0, FREE_INVOICE_LIMIT - existingInvoices)
    if (room <= 0) {
      return NextResponse.json(
        { ok: false, error: "Free plan covers 3 invoices — upgrade to Pro to import more." },
        { status: 403 },
      )
    }
    invoices.splice(room)
  }
  let clientIdMap = new Map<string, string | null>()
  let clientCount = await countForUser(user!.id, "clients")

  async function resolveClient(name: string | null, email: string | null): Promise<string | null> {
    const key = email ? `e:${email.toLowerCase()}` : name ? `n:${name.toLowerCase()}` : null
    if (!key) return null
    if (clientIdMap.has(key)) return clientIdMap.get(key) ?? null
    if (email) {
      const { data: existing } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user!.id)
        .eq("billing_email", email)
        .maybeSingle()
      if (existing) {
        clientIdMap.set(key, existing.id)
        return existing.id
      }
    }
    // Free plan: hard-cap the number of clients.
    if (plan === "free" && clientCount >= FREE_CLIENT_LIMIT) {
      errors.push("Free plan is limited to 1 client — upgrade to Pro to import more.")
      clientIdMap.set(key, null)
      return null
    }
    const { data: created } = await supabase
      .from("clients")
      .insert({
        user_id: user!.id,
        name: name ?? email ?? "Unknown client",
        email,
        billing_email: email,
      })
      .select("id")
      .single()
    if (created) clientCount++
    clientIdMap.set(key, created?.id ?? null)
    return created?.id ?? null
  }

  for (const inv of invoices) {
    const clientId = await resolveClient(inv.client_name, inv.client_email)
    const { error: iErr } = await supabase.from("invoices").upsert(
      {
        user_id: user!.id,
        client_id: clientId,
        provider: "manual",
        provider_id: `csv-${inv.number ?? inv.provider_id}`,
        number: inv.number,
        status: inv.status,
        amount_cents: inv.amount_cents,
        paid_cents: inv.paid_cents,
        currency: inv.currency,
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        paid_at: inv.paid_at,
        payment_url: inv.payment_url ?? null,
      },
      { onConflict: "user_id,provider,provider_id" },
    )
    if (iErr) errors.push(iErr.message)
  }

  // Mark csv integration present + attach ladders.
  await supabase
    .from("integrations")
    .upsert(
      { user_id: user!.id, provider: "csv", status: "connected", display_name: "CSV import", last_synced_at: new Date().toISOString() },
      { onConflict: "user_id,provider" },
    )
  await attachDefaultRuns(user!.id)

  return NextResponse.json({
    ok: true,
    result: { added: invoices.length, updated: 0, errors },
  })
}