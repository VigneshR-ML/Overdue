import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { processInboundReply, extractThreadHeaders } from "@/lib/scheduler/inbound"
import { verifyInboundReplySignature } from "@/lib/webhooks/signatures"

export const dynamic = "force-dynamic"

/**
 * Inbound mailbox webhook (reply detection). Protected by a shared secret so
 * strangers can't pause arbitrary runs.
 *
 * We need the CLIENT who replied -> their address is the SENDER ("from") of the
 * inbound message, not "to" (which is our own reply-to mailbox). Field names
 * vary by provider, so we probe several common shapes. Svix endpoints register
 * via GET and deliver signed POSTs (svix-id/svix-timestamp/svix-signature).
 */
export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 })
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get("svix-signature") ?? ""
  const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  const svixId = request.headers.get("svix-id") ?? undefined
  const svixTimestamp = request.headers.get("svix-timestamp") ?? undefined
  if (
    !verifyInboundReplySignature({ signature, bearer, rawBody, svixId, svixTimestamp })
  ) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 })
  }

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 })
  }

  const from =
    body.from ||
    body.sender ||
    body.message?.from ||
    body.envelope?.from ||
    (Array.isArray(body.headers)
      ? (body.headers as Array<{ name: string; value: string }>).find((h) => h.name?.toLowerCase() === "from")?.value
      : body.headers?.From) ||
    ""

  const raw = (Array.isArray(from) ? from[0] : from)?.trim() ?? ""
  // Strip display name from "John Doe <john@example.com>" format.
  const fromEmail = raw.replace(/^[^<]*<([^>]+)>.*$/, "$1").trim()
  if (!fromEmail || !fromEmail.includes("@")) return NextResponse.json({ ok: true, skipped: "no sender" })

  // Reply text feeds promise-to-pay detection ("will pay Friday").
  // Probe common shapes; cap length so one email can't blow up the classifier.
  const text =
    body.text ||
    body.body ||
    body.message?.text ||
    body.message?.body ||
    body.snippet ||
    ""
  const clipped = String(Array.isArray(text) ? text[0] ?? "" : text).slice(0, 4000)

  const thread =
    extractThreadHeaders(body.headers) ??
    extractThreadHeaders(body.message?.headers) ??
    {}

  const handled = await processInboundReply(supabase, {
    fromEmail,
    text: clipped || undefined,
    inReplyTo: thread.inReplyTo,
    references: thread.references,
  })
  return NextResponse.json({ ok: true, classification: handled?.classification ?? undefined })
}