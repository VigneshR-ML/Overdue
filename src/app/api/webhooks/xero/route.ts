import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  verifyXeroSignature,
  markInvoicePaid,
  alreadyHandled,
  recordEvent,
  resolveXeroUser,
  freshXeroCreds,
  fetchXeroInvoiceStatus,
} from "@/lib/integrations/paid-webhooks"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Xero webhook (real-time paid detection). Xero invoice events carry no
 * status, so on INVOICE CREATE/UPDATE we fetch the invoice and only flip to
 * paid when Xero says PAID — never optimistically. Webhook signing key comes
 * from the Xero app → Webhooks page (XERO_WEBHOOK_KEY). Always 200 after a
 * valid signature so Xero stops retrying.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get("x-xero-signature") ?? ""
  if (!verifyXeroSignature(signature, rawBody)) {
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

  const events: any[] = Array.isArray(body.events) ? body.events : []
  let flipped = 0
  const handled: string[] = []
  for (const ev of events) {
    if (ev.eventCategory !== "INVOICE") continue
    const invoiceId = ev.resourceId ?? ""
    const tenantId = ev.tenantId ?? ""
    const eventId = `xero:${tenantId}:${invoiceId}:${ev.eventDateUtc ?? ""}`
    if (await alreadyHandled(supabase, "xero", eventId)) continue
    handled.push(`${ev.eventType}:${invoiceId}`)

    const userId = await resolveXeroUser(supabase, tenantId)
    if (userId) {
      const creds = await freshXeroCreds(userId)
      if (creds) {
        const status = await fetchXeroInvoiceStatus(creds.accessToken, creds.tenantId, invoiceId)
        if (status === "PAID") flipped += await markInvoicePaid(supabase, "xero", invoiceId)
      }
    }
    await recordEvent(supabase, "xero", eventId, ev)
  }

  return NextResponse.json({ ok: true, handled, flipped })
}
