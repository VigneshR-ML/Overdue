"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

interface Option {
  kind: "wait" | "settle"
  incentiveBps: number
  offerCents: number
  incentiveCents: number
  pToday: number
  expectedCents: number
  expectedDelayDays: number
}

interface Recommend {
  invoice: { id: string; number: string | null; currency: string; outstandingCents: number; daysOverdue: number }
  options: Option[]
  recommended: Option
  reason: string
}

const money = (c: number, cur: string) =>
  `${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })} ${cur}`

export function SettlementCard({ invoiceId }: { invoiceId: string }) {
  const [data, setData] = useState<Recommend | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [picked, setPicked] = useState<number>(0)
  const [basis, setBasis] = useState<"discount" | "fee_waiver">("discount")
  const [feeConfirmed, setFeeConfirmed] = useState(false)
  const [minAccept, setMinAccept] = useState("")
  const [maxBps, setMaxBps] = useState("500")
  const [approving, setApproving] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function load(minCents: number | null, maxIncentive: number | null) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/settlements/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          minAcceptableCents: minCents,
          maxIncentiveBps: maxIncentive,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error ?? "recommendation failed")
      setData(json)
      const idx = Math.max(
        0,
        (json.options as Option[]).findIndex(
          (o) => o.incentiveBps === (json.recommended as Option).incentiveBps && o.kind === "settle",
        ),
      )
      setPicked(idx)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load recommendation.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(null, 500)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId])

  async function approve() {
    if (!data) return
    const opt = data.options[picked]
    if (!opt || opt.kind !== "settle") {
      setError("Pick a settlement option first — or keep waiting (no offer needed).")
      return
    }
    if (basis === "fee_waiver" && !feeConfirmed) {
      setError("Confirm the late fee exists in your payment terms before offering a waiver.")
      return
    }
    setApproving(true)
    setError(null)
    try {
      const res = await fetch("/api/settlements/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId,
          offerCents: opt.offerCents,
          basis,
          minAcceptableCents: minAccept ? Math.round(parseFloat(minAccept) * 100) : null,
          maxIncentiveBps: parseInt(maxBps || "500", 10),
          feeBasisConfirmed: basis === "fee_waiver" ? true : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error ?? "approval failed")
      setLink(json.link)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed.")
    } finally {
      setApproving(false)
    }
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-hairline bg-surface p-5 shadow-ledger">
        <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-muted">Smart Settlement · analyzing…</p>
      </section>
    )
  }

  if (!data) {
    return error ? (
      <div role="alert" className="rounded-md border border-rust/40 bg-rust/10 p-3 text-[13px] text-crimson">
        {error}
      </div>
    ) : null
  }

  const cur = data.invoice.currency
  const settleOpts = data.options.filter((o) => o.kind === "settle")

  return (
    <section className="rounded-lg border border-moss/40 bg-surface p-5 shadow-ledger">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg text-ink">Smart Settlement</h2>
        <span className="font-mono text-[11px] text-faint">
          {money(data.invoice.outstandingCents, cur)} · {data.invoice.daysOverdue}d overdue
        </span>
      </div>
      <p className="mt-1 text-[13px] text-muted">{data.reason}</p>

      {settleOpts.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No incentive beats waiting within your guardrails — no offer needed.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {settleOpts.map((o) => {
            const globalIdx = data.options.indexOf(o)
            return (
              <label
                key={o.incentiveBps}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-md border p-3 ${
                  picked === globalIdx ? "border-moss/60 bg-moss-soft/40" : "border-hairline bg-paper"
                }`}
              >
                <span className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={picked === globalIdx}
                    onChange={() => setPicked(globalIdx)}
                    aria-label={`${o.incentiveBps / 100}% settlement`}
                  />
                  <span className="font-medium text-ink">Resolve today for {money(o.offerCents, cur)}</span>
                  <span className="font-mono text-[12px] text-moss">save {money(o.incentiveCents, cur)}</span>
                </span>
                <span className="font-mono text-[11px] text-faint">{Math.round(o.pToday * 100)}% today</span>
              </label>
            )
          })}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block text-[12px] text-muted">
          Min. acceptable (optional)
          <input
            value={minAccept}
            onChange={(e) => setMinAccept(e.target.value)}
            placeholder={String(data.invoice.outstandingCents / 100)}
            inputMode="decimal"
            className="mt-1 h-9 w-full rounded-md border border-hairline bg-paper px-2 font-mono text-[13px] text-ink focus:border-ink-soft focus:outline-none"
          />
        </label>
        <label className="block text-[12px] text-muted">
          Max incentive (bps, 100 = 1%)
          <input
            value={maxBps}
            onChange={(e) => setMaxBps(e.target.value)}
            inputMode="numeric"
            className="mt-1 h-9 w-full rounded-md border border-hairline bg-paper px-2 font-mono text-[13px] text-ink focus:border-ink-soft focus:outline-none"
          />
        </label>
        <label className="block text-[12px] text-muted">
          Offer basis
          <select
            value={basis}
            onChange={(e) => setBasis(e.target.value as "discount" | "fee_waiver")}
            className="mt-1 h-9 w-full rounded-md border border-hairline bg-paper px-2 font-mono text-[13px] text-ink focus:border-ink-soft focus:outline-none"
          >
            <option value="discount">Immediate-settlement discount</option>
            <option value="fee_waiver">Late-fee waiver</option>
          </select>
        </label>
      </div>

      {basis === "fee_waiver" ? (
        <label className="mt-3 flex items-start gap-2 text-[13px] text-muted">
          <input type="checkbox" checked={feeConfirmed} onChange={(e) => setFeeConfirmed(e.target.checked)} className="mt-1" />
          This late fee exists in my payment terms — I&apos;m authorized to waive it for immediate payment.
        </label>
      ) : null}

      {error ? (
        <div role="alert" className="mt-3 rounded-md border border-rust/40 bg-rust/10 p-3 text-[13px] text-crimson">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            load(
              minAccept ? Math.round(parseFloat(minAccept || "0") * 100) : null,
              parseInt(maxBps || "500", 10),
            )
          }
        >
          Re-calculate
        </Button>
        <Button type="button" size="sm" variant="moss" disabled={approving || settleOpts.length === 0} onClick={approve}>
          {approving ? "Creating…" : "Approve & get resolution link"}
        </Button>
      </div>

      {link ? (
        <div className="mt-3 rounded-md border border-moss/40 bg-moss-soft p-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-moss">Resolution link · expires tonight</div>
          <div className="mt-1 break-all font-mono text-[13px] text-ink">{link}</div>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="ink"
              onClick={() => {
                navigator.clipboard?.writeText(link).catch(() => {})
                setCopied(true)
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </Button>
            <a href={link} target="_blank" rel="noreferrer">
              <Button type="button" size="sm" variant="outline">
                Preview
              </Button>
            </a>
          </div>
          <p className="mt-2 text-[12px] text-muted">
            Send it instead of the next reminder. Payment moves over the invoice&apos;s existing payment link; acceptance
            and promises are tracked automatically.
          </p>
        </div>
      ) : null}
    </section>
  )
}
