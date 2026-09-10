import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createClient } from "@/lib/supabase/server"
import { getPlan, countForUser, FREE_CLIENT_LIMIT } from "@/lib/billing/plan"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  const body = await request.json()
  const name = String(body.name ?? "").trim().slice(0, 120)
  const email = String(body.email ?? "").trim().slice(0, 200)

  if (!name) {
    return NextResponse.json({ ok: false, error: "Client name is required" }, { status: 400 })
  }

  const supabase = createClient()
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
