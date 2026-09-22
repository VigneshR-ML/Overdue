import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { getPlan, countForUser, FREE_CLIENT_LIMIT } from "@/lib/billing/plan"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  const rl = await rateLimit(`clients:${user!.id}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }) }
  const name = String(body.name ?? "").trim().slice(0, 120)
  const email = String(body.email ?? "").trim().slice(0, 200)

  if (!name) {
    return NextResponse.json({ ok: false, error: "Client name is required" }, { status: 400 })
  }

  // A malformed contact email would produce a hard-bouncing reminder for
  // every rung — reject it here instead of learning that from the provider.
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "email is invalid" }, { status: 400 })
  }

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })
  const plan = await getPlan(user!.id)

  if (plan === "free" && (await countForUser(user!.id, "clients")) >= FREE_CLIENT_LIMIT) {
    return NextResponse.json(
      { ok: false, error: "Free plan covers 3 clients — upgrade to Pro for unlimited." },
      { status: 403 },
    )
  }

  const { data, error: insertErr } = await supabase
    .from("clients")
    .insert({
      user_id: user!.id,
      name,
      email: email || null,
      billing_email: email || null,
    })
    .select("id")
    .single()

  if (insertErr) return NextResponse.json({ ok: false, error: insertErr.message }, { status: 400 })

  return NextResponse.json({ ok: true, id: data.id })
}
