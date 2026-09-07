import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createClient } from "@/lib/supabase/server"
import { setCredentials } from "@/lib/integrations/credentials"
import { syncUserProvider } from "@/lib/integrations/sync"
import { getPlan } from "@/lib/billing/plan"

export const dynamic = "force-dynamic"

/** POST /api/integrations/paypal/save — store user-provided API creds + sync */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  const plan = await getPlan(user!.id)
  if (plan === "free") {
    return NextResponse.json(
      { ok: false, error: "Integrations are a Pro feature — upgrade to connect PayPal." },
      { status: 403 },
    )
  }

  const body = await request.json()
  const clientId = String(body.clientId ?? "").trim()
  const clientSecret = String(body.clientSecret ?? "").trim()
  const mode = body.mode === "live" ? "live" : "sandbox"

  if (!clientId || !clientSecret) {
    return NextResponse.json({ ok: false, error: "client_id and client_secret required" }, { status: 400 })
  }

  const credErr = await setCredentials(user!.id, "paypal", {
    client_id: clientId,
    client_secret: clientSecret,
    mode,
  })
  if (credErr) return NextResponse.json({ ok: false, error: credErr.message }, { status: 400 })

  const supabase = createClient()
  await supabase.from("integrations").upsert(
    {
      user_id: user!.id,
      provider: "paypal",
      status: "connected",
      display_name: mode === "live" ? "PayPal (live)" : "PayPal (sandbox)",
    },
    { onConflict: "user_id,provider" },
  )

  const syncResult = await syncUserProvider(user!.id, "paypal")
  return NextResponse.json({ ok: true, result: syncResult.result })
}