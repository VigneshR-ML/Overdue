import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"
import { verifyResolutionToken } from "@/lib/recovery/token"
import { dateOnlyToUtcMs, DAY_MS, utcStartOfDay } from "@/lib/utils/format"
import { formatMoney } from "@/lib/utils/format"
import { notifyOwner } from "@/lib/notifications/owner"

export const dynamic = "force-dynamic"

type Action = "accept" | "promise" | "plan_request" | "dispute"

async function loadOffer(offerId: string) {
  const supabase = createAdminClient()
  if (!supabase) return { supabase: null, offer: null as unknown }
  const { data } = await supabase
    .from("settlement_offers")
    .select("id, user_id, invoice_id, outstanding_cents, offer_cents, incentive_cents, basis, expires_at, status, settlement_payment_url")
    .eq("id", offerId)
    .single()
  return { supabase, offer: data as Record<string, unknown> | null }
}

/**
 * Public debtor resolution — no login. Token is HMAC-signed; offer must be
 * live and unexpired. Promise actions reuse the existing runs.promise_*
 * hold so the dispatcher pauses ladder sends until the date (and escalates
 * as promise-broken after it passes).
 */
export async function POST(request: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const rl = await rateLimit(
    `resolve:${request.headers.get("x-forwarded-for") ?? "anon"}`,
    RATE_LIMITS.api.limit,
    RATE_LIMITS.api.windowMs,
  )
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  const verified = verifyResolutionToken(params.token)
  if (!verified) return NextResponse.json({ ok: false, error: "invalid link" }, { status: 404 })

  let body: {
    action?: unknown
    promiseDate?: unknown
    note?: unknown
    category?: unknown
    requestedCents?: unknown
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 })
  }
  const action = body.action as Action
  if (!["accept", "promise", "plan_request", "dispute"].includes(action)) {
    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 })
  }

  const { supabase, offer } = await loadOffer(verified.offerId)
  if (!supabase || !offer) return NextResponse.json({ ok: false, error: "offer not found" }, { status: 404 })

  const userId = offer.user_id as string
  const expired = new Date(offer.expires_at as string).getTime() <= Date.now()
  if (expired && offer.status !== "paid") {
    await supabase
      .from("settlement_offers")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", offer.id)
    await supabase.from("settlement_events").insert({ offer_id: offer.id, user_id: userId, event: "expired", meta: {} })
    return NextResponse.json({ ok: false, error: "offer expired — the full balance applies" }, { status: 410 })
  }
  if (!["approved", "sent", "accepted"].includes(offer.status as string)) {
    return NextResponse.json({ ok: false, error: "offer is no longer active" }, { status: 410 })
  }

  const note = typeof body.note === "string" ? body.note.slice(0, 500) : null

  if (action === "accept") {
    if (offer.status === "accepted") return NextResponse.json({ ok: true, status: "accepted" })
    const { data: accepted, error: acceptError } = await supabase
      .from("settlement_offers")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", offer.id)
      .in("status", ["approved", "sent"])
      .select("id")
      .maybeSingle()
    if (acceptError) return NextResponse.json({ ok: false, error: "couldn't accept the offer — please retry" }, { status: 503 })
    if (!accepted) return NextResponse.json({ ok: false, error: "offer state changed — refresh and try again" }, { status: 409 })
    await supabase.from("settlement_events").insert({ offer_id: offer.id, user_id: userId, event: "accepted", meta: {} })
    const { data: invoice } = await supabase.from("invoices").select("number, currency").eq("id", offer.invoice_id as string).single()
    const amount = formatMoney(Number(offer.offer_cents), invoice?.currency ?? "USD")
    await notifyOwner(supabase, {
      userId,
      type: offer.settlement_payment_url ? "settlement_accepted" : "payment_link_needed",
      title: offer.settlement_payment_url ? "Settlement accepted" : "Settlement accepted — add payment link",
      body: offer.settlement_payment_url ? `${invoice?.number ?? "Invoice"} was accepted for ${amount}.` : `${invoice?.number ?? "Invoice"} was accepted for ${amount}. Add the exact settlement payment link so the client can pay.`,
      href: `/invoices/${offer.invoice_id}#settlement`,
      dedupeKey: `settlement-accepted:${offer.id}`,
      meta: { offer_id: offer.id, invoice_id: offer.invoice_id },
    })
    return NextResponse.json({ ok: true, status: "accepted" })
  }

  if (action === "promise") {
    if (typeof body.promiseDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.promiseDate)) {
      return NextResponse.json({ ok: false, error: "promiseDate (YYYY-MM-DD) required" }, { status: 400 })
    }
    const promiseDay = dateOnlyToUtcMs(body.promiseDate)
    const today = utcStartOfDay()
    if (Number.isNaN(promiseDay) || promiseDay <= today || promiseDay - today > 60 * DAY_MS) {
      return NextResponse.json({ ok: false, error: "promise date must be within the next 60 days" }, { status: 400 })
    }
    // Hold the ladder through the promised calendar date, independent of the
    // deployment region's timezone.
    const at = new Date(promiseDay + DAY_MS - 1)
    // Hold open runs for this invoice until the promise date (dispatcher pattern).
    const { error: promiseError } = await supabase
      .from("runs")
      .update({
        status: "queued",
        next_run_at: at.toISOString(),
        promise_date: at.toISOString(),
        promise_note: note ?? "promise via resolution link",
        promise_amount_cents: (offer.offer_cents as number) ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("invoice_id", offer.invoice_id as string)
      .in("status", ["queued", "processing", "paused", "sent"])
    if (promiseError) return NextResponse.json({ ok: false, error: "couldn't save the promise — please retry" }, { status: 503 })
    await supabase.from("settlement_events").insert({
      offer_id: offer.id,
      user_id: userId,
      event: "promise",
      meta: { promise_date: body.promiseDate, note },
    })
    await notifyOwner(supabase, { userId, type: "payment_promise", title: "Payment date promised", body: `The client promised ${body.promiseDate}. Reminders pause until then.`, href: `/invoices/${offer.invoice_id}`, dedupeKey: `promise:${offer.id}:${body.promiseDate}`, meta: { offer_id: offer.id, invoice_id: offer.invoice_id, promise_date: body.promiseDate } })
    return NextResponse.json({ ok: true, status: "promise", promiseDate: body.promiseDate })
  }

  if (action === "plan_request") {
    // (D24) Payment-plan requests get a real row the owner can see and act on,
    // and the ladder pauses so autopilot never chases a client mid-negotiation.
    const requestedCents = typeof body.requestedCents === "number" && Number.isFinite(body.requestedCents)
      ? Math.round(body.requestedCents)
      : null
    if (requestedCents !== null && (requestedCents <= 0 || requestedCents > Number(offer.outstanding_cents))) {
      return NextResponse.json({ ok: false, error: "requested amount must be within the outstanding balance" }, { status: 400 })
    }
    const { data: existingPlan } = await supabase
      .from("payment_plan_requests")
      .select("id")
      .eq("invoice_id", offer.invoice_id as string)
      .eq("status", "open")
      .limit(1)
      .maybeSingle()
    if (!existingPlan) {
      const { error: planError } = await supabase.from("payment_plan_requests").insert({
        user_id: userId,
        offer_id: offer.id as string,
        invoice_id: offer.invoice_id as string,
        requested_cents: requestedCents,
        message: note ?? "",
        status: "open",
      })
      if (planError) return NextResponse.json({ ok: false, error: "couldn't save the payment-plan request — please retry" }, { status: 503 })
    }
    const { error: pauseError } = await supabase
      .from("runs")
      .update({
        status: "paused",
        automation_confidence: 10,
        reply_classification: "payment_plan",
        last_reply_at: new Date().toISOString(),
        error: "paused: open payment-plan request",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("invoice_id", offer.invoice_id as string)
      .in("status", ["queued", "processing", "sent"])
    if (pauseError) return NextResponse.json({ ok: false, error: "couldn't pause reminders — please retry" }, { status: 503 })
    if (!existingPlan) await supabase.from("settlement_events").insert({
      offer_id: offer.id,
      user_id: userId,
      event: "plan_request",
      meta: { note, requested_cents: requestedCents },
    })
    if (!existingPlan) await notifyOwner(supabase, { userId, type: "payment_plan", title: "Payment plan requested", body: "The client requested a payment plan; reminders are paused until you respond.", href: `/invoices/${offer.invoice_id}`, dedupeKey: `payment-plan:${offer.invoice_id}`, meta: { offer_id: offer.id, invoice_id: offer.invoice_id } })
    return NextResponse.json({ ok: true, status: "plan_request" })
  }

  // dispute → open a dispute row (blocks automated chasing until resolved)
  // and record the event.
  const category = typeof body.category === "string" ? body.category.slice(0, 60) : "other"
  const { data: existingDispute } = await supabase
    .from("disputes")
    .select("id")
    .eq("invoice_id", offer.invoice_id as string)
    .eq("status", "open")
    .limit(1)
    .maybeSingle()
  if (!existingDispute) {
    const { error: disputeError } = await supabase.from("disputes").insert({
      user_id: userId,
      invoice_id: offer.invoice_id as string,
      category,
      amount_cents: (offer.outstanding_cents as number) ?? null,
      reason: note,
      status: "open",
    })
    if (disputeError) return NextResponse.json({ ok: false, error: "couldn't save the dispute — please retry" }, { status: 503 })
  }
  // (D05) Pause the ladder so the dispatcher never auto-chases mid-dispute.
  const { error: pauseError } = await supabase
    .from("runs")
    .update({
      status: "paused",
      automation_confidence: 10,
      reply_classification: "dispute",
      last_reply_at: new Date().toISOString(),
      error: "paused: client dispute via resolution link",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("invoice_id", offer.invoice_id as string)
    .in("status", ["queued", "processing", "sent"])
  if (pauseError) return NextResponse.json({ ok: false, error: "couldn't pause reminders — please retry" }, { status: 503 })
  if (!existingDispute) await supabase.from("settlement_events").insert({
    offer_id: offer.id,
    user_id: userId,
    event: "dispute",
    meta: { category, note },
  })
  if (!existingDispute) await notifyOwner(supabase, { userId, type: "dispute", title: "Invoice issue reported", body: "The client reported an issue; reminders are paused for review.", href: `/invoices/${offer.invoice_id}`, dedupeKey: `dispute:${offer.invoice_id}`, meta: { offer_id: offer.id, invoice_id: offer.invoice_id } })
  return NextResponse.json({ ok: true, status: "dispute" })
}
