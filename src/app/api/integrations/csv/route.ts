import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createClient } from "@/lib/supabase/server"
import { parseCsv } from "@/lib/integrations/csv"
import { attachDefaultRuns } from "@/lib/scheduler/dispatch"
import { getPlan, countForUser, FREE_CLIENT_LIMIT, FREE_INVOICE_LIMIT } from "@/lib/billing/plan"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"

export const dynamic = "force-dynamic"

const MAX_CSV_BYTES = 10 * 1024 * 1024 // 10 MB

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  const rl = rateLimit(`csv-import:${user!.id}`, RATE_LIMITS.csvImport.limit, RATE_LIMITS.csvImport.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  // Enforce body size limit
  const contentLength = Number(request.headers.get("content-length") ?? 0)
  if (contentLength > MAX_CSV_BYTES) {
    return NextResponse.json({ ok: false, error: "CSV file too large (max 10 MB)." }, { status: 413 })
  }

  const csv = await request.text()
  if (csv.length > MAX_CSV_BYTES) {
    return NextResponse.json({ ok: false, error: "CSV file too large (max 10 MB)." }, { status: 413 })
  }
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
        { ok: false, error: "Free plan covers 10 invoices — upgrade to Pro to import more." },
        { status: 403 },
      )
    }
    invoices.splice(room)
  }

  // (D18) Which rows already exist, so reported added/updated counts are true.
  let alreadyExisting = 0
  {
    const { data: existing } = await supabase
      .from("invoices")
      .select("provider_id")
      .eq("user_id", user!.id)
      .eq("provider", "manual")
      .in(
        "provider_id",
        invoices.map((i) => i.provider_id),
      )
    alreadyExisting = existing?.length ?? 0
  }

  let clientIdMap = new Map<string, string | null>()
  let blockedKeys = new Set<string>()
  let clientCount = await countForUser(user!.id, "clients")

  async function resolveClient(
    name: string | null,
    email: string | null,
  ): Promise<{ clientId: string | null; blocked: boolean }> {
    const key = email ? `e:${email.toLowerCase()}` : name ? `n:${name.toLowerCase()}` : null
    if (!key) return { clientId: null, blocked: false }
    if (blockedKeys.has(key)) return { clientId: null, blocked: true }
    if (clientIdMap.has(key)) return { clientId: clientIdMap.get(key) ?? null, blocked: false }
    if (email) {
      const { data: existing } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user!.id)
        .eq("billing_email", email)
        .maybeSingle()
      if (existing) {
        clientIdMap.set(key, existing.id)
        return { clientId: existing.id, blocked: false }
      }
    }
    // Free plan: hard-cap the number of clients. (D18) A row whose client can't
    // be created is skipped entirely — orphan invoices would otherwise be
    // created with no owner even though the merchant is over the cap.
    if (plan === "free" && clientCount >= FREE_CLIENT_LIMIT) {
      clientIdMap.set(key, null)
      blockedKeys.add(key)
      return { clientId: null, blocked: true }
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
    return { clientId: created?.id ?? null, blocked: false }
  }

  let added = 0
  let updated = 0
  for (const inv of invoices) {
    const { clientId, blocked } = await resolveClient(inv.client_name, inv.client_email)
    if (blocked) {
      errors.push(`Row for ${inv.client_name || inv.number || "unknown client"} skipped (client limit reached)`)
      continue
    }
    const { error: iErr } = await supabase.from("invoices").upsert(
      {
        user_id: user!.id,
        client_id: clientId,
        provider: "manual",
        provider_id: inv.provider_id,
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
    else if (alreadyExisting > 0) {
      alreadyExisting--
      updated++
    } else added++
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
    result: { added, updated, errors },
  })
}