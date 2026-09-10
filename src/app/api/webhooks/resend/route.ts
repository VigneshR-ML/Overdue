import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyResendSignature } from "@/lib/paddle/helpers"

export const dynamic = "force-dynamic"

/**
 * Resend webhook. Marks messages opened/clicked and flags bounces so the
 * dispatcher can fail a run before more emails pile up.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get("svix-signature") ?? request.headers.get("resend-signature") ?? request.headers.get("webhook-signature") ?? ""
  if (!signature || !verifyResendSignature(signature, rawBody)) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 })
  }

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 })
  }
  const type = event.type ?? ""
  const data = event.data ?? {}
  const to = data.to ?? []
  const toEmail = Array.isArray(to) ? to[0] : to

  if (!toEmail) return NextResponse.json({ ok: true, skipped: "no recipient" })

  // Try to match the specific message by Resend's email ID first.
  const resendId = data.email_id ?? null
  let messages: any[] = []
  if (resendId) {
    const { data: byId } = await supabase
      .from("messages")
      .select("id, run_id")
      .eq("resend_message_id", resendId)
      .limit(1)
    if (byId?.length) messages = byId
  }
  if (!messages.length) {
    const { data: byEmail } = await supabase
      .from("messages")
      .select("id, run_id")
      .eq("to_email", toEmail)
      .order("sent_at", { ascending: false })
      .limit(3)
    messages = byEmail ?? []
  }

  if (!messages.length) return NextResponse.json({ ok: true, skipped: "no match" })

  const ids = messages.map((m: any) => m.id)
  const runIds = [...new Set(messages.map((m: any) => m.run_id).filter(Boolean))]

  if (type === "email.opened" || type === "email.clicked") {
    await supabase
      .from("messages")
      .update({ opened_at: new Date().toISOString() })
      .in("id", ids)
  }

  if (type === "email.delivered") {
    await supabase
      .from("messages")
      .update({ delivered_at: new Date().toISOString() })
      .in("id", ids)
  }

  if (type === "email.bounced" || type === "email.complained") {
    if (runIds.length) {
      await supabase
        .from("runs")
        .update({ status: "failed", error: type === "email.bounced" ? "bounced" : "complained", failed_at: new Date().toISOString() })
        .in("id", runIds)
    }
  }

  return NextResponse.json({ ok: true })
}
