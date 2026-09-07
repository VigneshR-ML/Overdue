import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyResendSignature } from "@/lib/paddle/helpers"

export const dynamic = "force-dynamic"

/**
 * Resend webhook (optional). Marks messages opened/clicked and flags bounces so
 * the dispatcher can fail a run before more emails pile up.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get("svix-signature") ?? request.headers.get("resend-signature") ?? request.headers.get("webhook-signature") ?? ""
  if (!signature || !verifyResendSignature(signature, rawBody)) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 })
  }

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })

  const event = JSON.parse(rawBody)
  const type = event.type ?? ""
  const data = event.data ?? {}
  const to = data.to ?? []
  const toEmail = Array.isArray(to) ? to[0] : to

  if (!toEmail) return NextResponse.json({ ok: true, skipped: "no recipient" })

  const { data: messages } = await supabase
    .from("messages")
    .select("id, run_id")
    .eq("to_email", toEmail)
    .order("sent_at", { ascending: false })
    .limit(3)

  if (!messages?.length) return NextResponse.json({ ok: true, skipped: "no match" })

  const ids = messages.map((m) => m.id)
  const runIds = [...new Set(messages.map((m) => m.run_id).filter(Boolean))]

  if (type === "email.opened") {
    await supabase
      .from("messages")
      .update({ opened_at: new Date().toISOString() })
      .in("id", ids)
  }

  if (type === "email.bounced" || type === "email.complained") {
    if (runIds.length) {
      await supabase.from("runs").update({ status: "failed" }).in("id", runIds)
    }
  }

  return NextResponse.json({ ok: true })
}