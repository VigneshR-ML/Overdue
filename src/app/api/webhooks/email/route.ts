import { NextResponse, type NextRequest } from "next/server"
import { handleInboundReply } from "@/lib/scheduler/dispatch"
import { verifyInboundReplySignature } from "@/lib/paddle/helpers"

export const dynamic = "force-dynamic"

/**
 * Inbound mailbox webhook (reply detection). Protected by a shared secret so
 * strangers can't pause arbitrary runs.
 *
 * We need the CLIENT who replied -> their address is the SENDER ("from") of the
 * inbound message, not "to" (which is our own reply-to mailbox). Field names
 * vary by provider, so we probe several common shapes.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get("svix-signature") ?? ""
  const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")
  if (!verifyInboundReplySignature({ signature, bearer, rawBody })) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 })
  }

  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    body = {}
  }

  const from =
    body.from ||
    body.sender ||
    body.message?.from ||
    body.envelope?.from ||
    body.headers?.From ||
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

  const handled = await handleInboundReply(fromEmail, clipped || undefined)
  return NextResponse.json({ ok: true, classification: handled ?? undefined })
}
