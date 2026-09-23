"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { currentTimeMs } from "@/lib/utils/format"
import { formatMoney } from "@/lib/utils/format"

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
  proposedPlan?: {
    id: string
    totalCents: number
    currency: string
    frequency: string
    startsOn: string
    installmentCount: number
    installments: { amountCents: number; dueDate: string; status: string }[]
  } | null
}

const money = (c: number, cur: string) => formatMoney(c, cur)

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
  const [showPlan, setShowPlan] = useState(false)
  const [preferredCents, setPreferredCents] = useState("")
  const [frequency, setFrequency] = useState("monthly")
  const [startDate, setStartDate] = useState("")
  const [planBusy, setPlanBusy] = useState<"accept" | "decline" | null>(null)

  const expired = new Date(offer.expiresAt).getTime() <= currentTimeMs()
  const canAcceptOffer = !expired && ["approved", "sent", "accepted"].includes(offer.status) && !offer.proposedPlan

  async function decidePlan(action: "accept" | "decline") {
    if (!offer.proposedPlan) return
    setPlanBusy(action)
    setError(null)
    try {
      const res = await fetch(`/api/r/${encodeURIComponent(offer.token)}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: offer.proposedPlan.id, action }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error ?? "Could not update payment plan")
      setDone(action === "accept" ? "plan_accepted" : "plan_declined")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.")
    } finally {
      setPlanBusy(null)
    }
  }

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
          {offer.paymentUrl ? <>Complete payment through the secure link below.</> : <>The business has been notified and will send an exact payment link.</>}
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
        <p className="mt-2 text-sm text-muted">The business will propose a payment schedule shortly. You will get a fresh link — reminders pause for 72h while they review.</p>
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
        {canAcceptOffer ? (
          <div className="mt-5 space-y-2">
            <Button size="lg" variant="moss" className="w-full" disabled={busy !== null} onClick={() => act("accept")}>
              {busy === "accept" ? "Accepting…" : `Accept offer for ${money(offer.offerCents, offer.currency)}`}
            </Button>
            {offer.paymentUrl ? (
              <p className="font-mono text-[11px] text-faint">Secure payment via the business&apos;s payment link after accepting.</p>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 rounded-md border border-ember/40 bg-ember/10 p-3 text-sm">
            {offer.proposedPlan
              ? "A payment-plan proposal is ready below. Review that schedule instead of accepting the old settlement offer."
              : "This offer expired or is no longer active. You can still choose a payment date or report an issue below."}
          </p>
        )}
      </div>

      {offer.proposedPlan && !done?.startsWith("plan_") ? (
        <div className="rounded-lg border border-moss/40 bg-moss-soft p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-moss">Payment plan ready</p>
          <h2 className="mt-1 font-display text-xl text-ink">Review your proposed schedule</h2>
          <p className="mt-2 text-sm text-ink-soft">
            {offer.proposedPlan.installmentCount} {offer.proposedPlan.frequency} payments starting {offer.proposedPlan.startsOn}.
            Total: {money(offer.proposedPlan.totalCents, offer.proposedPlan.currency)}.
          </p>
          <div className="mt-3 max-h-40 overflow-y-auto rounded-md border border-moss/20 bg-paper">
            {offer.proposedPlan.installments.map((installment, index) => (
              <div key={`${installment.dueDate}-${index}`} className="flex items-center justify-between border-b border-hairline px-3 py-2 text-sm last:border-0">
                <span>Payment {index + 1} · {installment.dueDate}</span>
                <span className="font-mono">{money(installment.amountCents, offer.proposedPlan!.currency)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="moss" disabled={planBusy !== null} onClick={() => decidePlan("accept")}>
              {planBusy === "accept" ? "Accepting…" : "Accept payment plan"}
            </Button>
            <Button type="button" variant="outline" disabled={planBusy !== null} onClick={() => decidePlan("decline")}>
              {planBusy === "decline" ? "Declining…" : "Decline"}
            </Button>
          </div>
        </div>
      ) : null}

      {done === "plan_accepted" ? (
        <div className="rounded-lg border border-moss/40 bg-moss-soft p-4 text-sm text-ink">Payment plan accepted. Your first payment is scheduled for {offer.proposedPlan?.startsOn}.</div>
      ) : null}
      {done === "plan_declined" ? (
        <div className="rounded-lg border border-hairline bg-surface p-4 text-sm text-muted">The proposal was declined. The business has been notified.</div>
      ) : null}

      <div className="rounded-lg border border-hairline bg-surface p-5">
        <h2 className="font-display text-lg text-ink">Can&apos;t pay today?</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={() => { setShowPromise((s) => !s); setShowDispute(false); setShowPlan(false) }}>
            I can pay on another date
          </Button>
          <Button type="button" variant="outline" onClick={() => { setShowPlan((s) => !s); setShowPromise(false); setShowDispute(false) }}>
            {busy === "plan_request" ? "Sending…" : "Request a payment plan"}
          </Button>
        </div>

        {showPlan ? (
          <div className="mt-3 space-y-2 rounded-md border border-hairline bg-paper p-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="text-[12px] text-muted">Per installment (cents)
                <input value={preferredCents} onChange={(e) => setPreferredCents(e.target.value)} inputMode="numeric" placeholder="e.g. 30000" className="mt-1 h-9 w-full rounded-md border border-hairline bg-paper px-2 font-mono text-[13px]" />
              </label>
              <label className="text-[12px] text-muted">Frequency
                <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-hairline bg-paper px-2 font-mono text-[13px]">
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every 2 weeks</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
              <label className="text-[12px] text-muted">First payment
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-hairline bg-paper px-2 font-mono text-[13px]" />
              </label>
            </div>
            <p className="font-mono text-[11px] text-faint">Your amount is treated as a preferred maximum — we never silently increase it. If policy limits require larger payments, the counter-proposal will say so explicitly.</p>
            <Button type="button" size="sm" variant="ink" disabled={busy !== null} onClick={() => act("plan_request", {
              requestedCents: preferredCents ? Number(preferredCents) : undefined,
              frequency, preferredStartDate: startDate || undefined,
            })}>
              {busy === "plan_request" ? "Sending…" : "Send plan request"}
            </Button>
          </div>
        ) : null}

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
