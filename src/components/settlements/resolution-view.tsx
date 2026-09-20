"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { currentTimeMs } from "@/lib/utils/format"

function PayButton({ offer }: { offer: PublicOffer }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pay() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/r/${encodeURIComponent(offer.token)}/pay`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) {
        if (json?.no_payment_url) {
          // (D03) Discounted intent recorded; no link yet — never treat the
          // full-price page as the amount due.
          setError(
            `You owe ${money(json.offer_cents ?? offer.offerCents, offer.currency)}. The business has been notified and will send a payment link for exactly that amount.`,
          )
          return
        }
        throw new Error(json?.error ?? "request failed")
      }
      window.location.href = json.payUrl as string
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4">
      <Button size="lg" variant="moss" className="w-full" disabled={busy} onClick={pay}>
        {busy ? "Preparing payment…" : `Pay ${money(offer.offerCents, offer.currency)} now`}
      </Button>
      <p className="mt-2 font-mono text-[11px] text-faint">
        Paying the discounted offer, not the original balance.
      </p>
    </div>
  )
}

export interface PublicOffer {
  token: string
  invoiceNumber: string | null
  businessName: string
  currency: string
  outstandingCents: number
  offerCents: number
  incentiveCents: number
  basis: "discount" | "fee_waiver"
  expiresAt: string
  status: string
  paymentUrl: string | null
  daysOverdue: number
}

const money = (c: number, cur: string) =>
  `${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${cur}`

const DISPUTE_CATS = [
  "Incorrect amount",
  "Missing credit",
  "Wrong purchase order",
  "Work not completed",
  "Duplicate invoice",
  "Tax issue",
  "Other",
]

// Promise window must mirror the API (resolve/route.ts): date at noon must be
// in the future and within 60 days. min = tomorrow (today at noon is already
// past by afternoon, which the server rejects), max = +60 days. Without
// these the picker accepts dates the server then refuses after submit.
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
const MIN_PROMISE_DATE = isoDate(new Date(Date.now() + 86400000))
const MAX_PROMISE_DATE = isoDate(new Date(Date.now() + 60 * 86400000))

export function ResolutionView({ offer }: { offer: PublicOffer }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [promiseDate, setPromiseDate] = useState("")
  const [note, setNote] = useState("")
  const [category, setCategory] = useState(DISPUTE_CATS[0])
  const [showPromise, setShowPromise] = useState(false)
  const [showDispute, setShowDispute] = useState(false)

  const expired = new Date(offer.expiresAt).getTime() <= currentTimeMs()

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action)
    setError(null)
    try {
      if (action === "promise") {
        const d = String(extra.promiseDate ?? "")
        if (d < MIN_PROMISE_DATE || d > MAX_PROMISE_DATE) {
          throw new Error(`Pick a date between ${MIN_PROMISE_DATE} and ${MAX_PROMISE_DATE}.`)
        }
      }
      const res = await fetch(`/api/r/${encodeURIComponent(offer.token)}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note || undefined, ...extra }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error ?? "request failed")
      if (action === "accept") setDone("accepted")
      else if (action === "promise") setDone(`promise:${json.promiseDate}`)
      else if (action === "plan_request") setDone("plan")
      else setDone("dispute")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.")
    } finally {
      setBusy(null)
    }
  }

  if (done === "accepted") {
    return (
      <div className="rounded-lg border border-moss/40 bg-moss-soft p-6 text-center">
        <h1 className="font-display text-2xl text-ink">Offer accepted.</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {money(offer.offerCents, offer.currency)} resolves invoice {offer.invoiceNumber ?? ""}.{" "}
          {offer.paymentUrl ? (
            <>Complete payment through the secure payment link below — the business is notified automatically.</>
          ) : (
            <>The business has been notified and will confirm payment.</>
          )}
        </p>
        <PayButton offer={offer} />
        {error ? (
          <div role="alert" className="mt-3 rounded-md border border-rust/40 bg-rust/10 p-3 text-[13px] text-crimson">
            {error}
          </div>
        ) : null}
      </div>
    )
  }

  if (done && done.startsWith("promise:")) {
    return (
      <div className="rounded-lg border border-moss/40 bg-moss-soft p-6 text-center">
        <h1 className="font-display text-2xl text-ink">Payment date recorded.</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {money(offer.offerCents, offer.currency)} promised for {done.slice("promise:".length)}. Reminders pause
          until then — if the date passes unpaid, follow-ups resume automatically.
        </p>
      </div>
    )
  }

  if (done === "plan") {
    return (
      <div className="rounded-lg border border-hairline bg-surface p-6 text-center">
        <h1 className="font-display text-2xl text-ink">Request received.</h1>
        <p className="mt-2 text-sm text-muted">The business will propose a payment schedule shortly.</p>
      </div>
    )
  }

  if (done === "dispute") {
    return (
      <div className="rounded-lg border border-hairline bg-surface p-6 text-center">
        <h1 className="font-display text-2xl text-ink">Issue reported.</h1>
        <p className="mt-2 text-sm text-muted">
          The business has been notified and automated reminders pause while the issue is reviewed.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-hairline bg-surface p-6 text-center shadow-ledger">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          {offer.businessName} · Invoice {offer.invoiceNumber ?? "—"}
        </div>
        <h1 className="mt-2 font-display text-3xl tracking-tight text-ink">Resolve this invoice today</h1>
        <div className="mt-4 flex items-baseline justify-center gap-3">
          <span className="font-mono text-[15px] text-faint line-through">{money(offer.outstandingCents, offer.currency)}</span>
          <span className="font-display text-4xl text-ink">{money(offer.offerCents, offer.currency)}</span>
        </div>
        <p className="mt-1 text-sm text-moss">
          Save {money(offer.incentiveCents, offer.currency)}
          {offer.basis === "fee_waiver" ? " in waived late fees" : ""} ·{" "}
          {expired ? "offer expired" : `offer ends ${new Date(offer.expiresAt).toLocaleString()}`}
        </p>
        {!expired ? (
          <div className="mt-5 space-y-2">
            <Button size="lg" variant="moss" className="w-full" disabled={busy !== null} onClick={() => act("accept")}>
              {busy === "accept" ? "Reserving…" : `Resolve for ${money(offer.offerCents, offer.currency)}`}
            </Button>
            {offer.paymentUrl ? (
              <p className="font-mono text-[11px] text-faint">Secure payment via the business&apos;s payment link after accepting.</p>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 rounded-md border border-ember/40 bg-ember/10 p-3 text-sm">
            This offer expired — the full {money(offer.outstandingCents, offer.currency)} applies. You can still choose
            a payment date or report an issue below.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-hairline bg-surface p-5">
        <h2 className="font-display text-lg text-ink">Can&apos;t pay today?</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={() => { setShowPromise((s) => !s); setShowDispute(false) }}>
            I can pay on another date
          </Button>
          <Button type="button" variant="outline" onClick={() => act("plan_request")}>
            {busy === "plan_request" ? "Sending…" : "Request a payment plan"}
          </Button>
        </div>

        {showPromise ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-[12px] text-muted">
              Payment date
              <input
                type="date"
                value={promiseDate}
                min={MIN_PROMISE_DATE}
                max={MAX_PROMISE_DATE}
                onChange={(e) => setPromiseDate(e.target.value)}
                className="ml-2 h-9 rounded-md border border-hairline bg-paper px-2 font-mono text-[13px]"
              />
            </label>
            <Button
              type="button"
              size="sm"
              variant="ink"
              disabled={!promiseDate || busy !== null}
              onClick={() => act("promise", { promiseDate })}
            >
              {busy === "promise" ? "Saving…" : "Confirm date"}
            </Button>
          </div>
        ) : null}

        <div className="mt-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => { setShowDispute((s) => !s); setShowPromise(false) }}>
            There&apos;s a problem with this invoice
          </Button>
          {showDispute ? (
            <div className="mt-2 space-y-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-9 w-full rounded-md border border-hairline bg-paper px-2 font-mono text-[13px]"
              >
                {DISPUTE_CATS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What is blocking payment? (optional)"
                rows={2}
                className="w-full rounded-md border border-hairline bg-paper p-2 text-sm"
              />
              <Button type="button" size="sm" variant="ink" disabled={busy !== null} onClick={() => act("dispute", { category })}>
                {busy === "dispute" ? "Sending…" : "Report issue"}
              </Button>
            </div>
          ) : null}
        </div>

        {error ? (
          <div role="alert" className="mt-3 rounded-md border border-rust/40 bg-rust/10 p-3 text-[13px] text-crimson">
            {error}
          </div>
        ) : null}

        <p className="mt-3 font-mono text-[11px] leading-relaxed text-faint">
          Your choice is shared with {offer.businessName} and tracked automatically — no more generic reminders once
          you&apos;ve responded.
        </p>
      </div>
    </div>
  )
}
