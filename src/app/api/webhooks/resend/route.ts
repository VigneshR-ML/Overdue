import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyResendSignature } from "@/lib/webhooks/signatures"
import { alreadyHandled, recordEvent } from "@/lib/integrations/paid-webhooks"
import { processInboundReply, extractThreadHeaders } from "@/lib/scheduler/inbound"

export const dynamic = "force-dynamic"

/**
 * Resend webhook. Marks messages opened/clicked and flags bounces so the
 * dispatcher can fail a run before more emails pile up.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get("svix-signature") ?? request.headers.get("resend-signature") ?? request.headers.get("webhook-signature") ?? ""
  const svixId = request.headers.get("svix-id") ?? undefined
  const svixTimestamp = request.headers.get("svix-timestamp") ?? undefined
  let valid = false
  try {
    valid = Boolean(signature) && verifyResendSignature(signature, rawBody, { svixId, svixTimestamp })
  } catch {
    valid = false
  }
  if (!valid) {
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

  // Idempotency check
  const eventId = event.id ?? event.message_id ?? ""
  if (eventId && await alreadyHandled(supabase, "resend", eventId)) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  const type = event.type ?? ""
  const data = event.data ?? {}

  // (D06) Inbound replies (native Resend inbound): a client replying to one of
  // our reminders. Match by thread (In-Reply-To/References) then pause/classify
  // — previously these arrived as email.received and fell through to "no match".
  if (type === "email.received") {
    const from = data.from ?? data.message?.from ?? ""
    const fromRaw = String(Array.isArray(from) ? from[0] ?? "" : from)
    const fromEmail = fromRaw.replace(/^[^<]*<([^>]+)>.*$/, "$1").trim()
    const text = data.text ?? data.message?.text ?? data.body ?? ""
    const thread = extractThreadHeaders(data.headers) ?? {}
    const handled = await processInboundReply(supabase, {
      fromEmail,
      text: String(text).slice(0, 4000) || undefined,
      inReplyTo: thread.inReplyTo,
      references: thread.references,
    })
    if (eventId) {
      await recordEvent(supabase, "resend", eventId, event)
    }
    return NextResponse.json({ ok: true, classification: handled?.classification ?? undefined })
  }

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

  // Record event for idempotency
  if (eventId) {
    await recordEvent(supabase, "resend", eventId, event)
  }

  return NextResponse.json({ ok: true })
}
