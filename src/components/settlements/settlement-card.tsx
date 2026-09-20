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

const formatEnd = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "soon"
  const sameDay = d.toDateString() === new Date().toDateString()
  const t = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  return sameDay ? `today at ${t}` : `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${t}`
}

export function SettlementCard({ invoiceId }: { invoiceId: string }) {
  const [data, setData] = useState<Recommend | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [picked, setPicked] = useState<number>(0)
  const [basis, setBasis] = useState<"discount" | "fee_waiver">("discount")
  const [feeConfirmed, setFeeConfirmed] = useState(false)
  const [minAccept, setMinAccept] = useState("")
  const [maxIncentivePct, setMaxIncentivePct] = useState("5")
  const [approving, setApproving] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
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
    // The request resolves asynchronously and is re-run only when the invoice changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
          maxIncentiveBps: Math.round(parseFloat(maxIncentivePct || "5") * 100),
          feeBasisConfirmed: basis === "fee_waiver" ? true : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error ?? "approval failed")
      setLink(json.link)
      setExpiresAt(typeof json.expiresAt === "string" ? json.expiresAt : null)
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
  const waitOpt = data.options.find((o) => o.kind === "wait")

  const estToday = (o: Option) => `est. ${money(o.expectedCents, cur)} collected today`
  const estWait = (o: Option) => `est. ${money(o.expectedCents, cur)} within ~${o.expectedDelayDays}d`

  return (
    <section className="rounded-lg border border-moss/40 bg-surface p-5 shadow-ledger">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg text-ink">Smart Settlement</h2>
        <span className="font-mono text-[11px] text-faint">
          {money(data.invoice.outstandingCents, cur)} · {data.invoice.daysOverdue}d overdue
        </span>
      </div>
      <p className="mt-1 text-[13px] text-muted">{data.reason}</p>

      <div className="mt-3 space-y-2">
        {waitOpt ? (
          <label
            className={`flex cursor-pointer flex-col gap-1 rounded-md border p-3 ${
              picked === 0 && !settleOpts.length ? "border-moss/60 bg-moss-soft/40" : "border-dashed border-hairline bg-paper"
            }`}
          >
            <span className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={picked === 0}
                  onChange={() => setPicked(0)}
                  aria-label="Keep the full amount and wait"
                />
                <span className="font-medium text-ink">Keep the full {money(waitOpt.offerCents, cur)} and wait</span>
              </span>
              <span className="font-mono text-[11px] text-faint">{Math.round(waitOpt.pToday * 100)}% today</span>
            </span>
            <span className="pl-6 font-mono text-[12px] text-muted">{estWait(waitOpt)} · no offer sent</span>
          </label>
        ) : null}

        {settleOpts.map((o) => {
          const globalIdx = data.options.indexOf(o)
          return (
            <label
              key={o.incentiveBps}
              className={`flex cursor-pointer flex-col gap-1 rounded-md border p-3 ${
                picked === globalIdx ? "border-moss/60 bg-moss-soft/40" : "border-hairline bg-paper"
              }`}
            >
              <span className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={picked === globalIdx}
                    onChange={() => setPicked(globalIdx)}
                    aria-label={`${o.incentiveBps / 100}% settlement`}
                  />
                  <span className="font-medium text-ink">Resolve today for {money(o.offerCents, cur)}</span>
                  <span className="font-mono text-[12px] text-moss">save {money(o.incentiveCents, cur)}</span>
                </span>
                <span className="font-mono text-[11px] text-faint">est. {Math.round(o.pToday * 100)}% today</span>
              </span>
              <span className="pl-6 font-mono text-[12px] text-muted">{estToday(o)}</span>
            </label>
          )
        })}
      </div>

      {settleOpts.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted">
          No incentive beats waiting within your guardrails — the model recommends holding out for the full amount, no offer needed.
        </p>
      ) : null}

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
          Max incentive (% of invoice)
          <input
            value={maxIncentivePct}
            onChange={(e) => setMaxIncentivePct(e.target.value)}
            inputMode="decimal"
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
              Math.round(parseFloat(maxIncentivePct || "5") * 100),
            )
          }
        >
          Re-calculate
        </Button>
        <Button type="button" size="sm" variant="moss" disabled={approving || settleOpts.length === 0} onClick={approve}>
          {approving ? "Creating…" : "Approve & get resolution link"}
        </Button>
      </div>
      <p className="mt-3 font-mono text-[11px] leading-relaxed text-faint">
        Percentages are the model&apos;s estimate from this invoice&apos;s age and the client&apos;s history (opens, disputes,
        average lateness) — an expectation, not a promise. Approving sends a live offer: the next reminder carries a
        &ldquo;Resolve&rdquo; button and anything the client accepts is tracked on the invoice.
      </p>

      {link ? (
        <div className="mt-3 rounded-md border border-moss/40 bg-moss-soft p-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-moss">
            Resolution link · {expiresAt ? `ends ${formatEnd(expiresAt)}` : "expires"}
          </div>
          <div className="mt-1 break-all font-mono text-[13px] text-ink">{link}</div>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="ink"
              onClick={async () => {
                try {
                  if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(link)
                  } else {
                    const ta = document.createElement("textarea")
                    ta.value = link
                    ta.style.position = "fixed"
                    ta.style.opacity = "0"
                    document.body.appendChild(ta)
                    ta.select()
                    document.execCommand("copy")
                    ta.remove()
                  }
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 1600)
                } catch {
                  // Clipboard denied — leave the raw link selectable on screen.
                }
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
            Attached to this invoice&apos;s ladder automatically — the next reminder carries a
            &ldquo;Resolve&rdquo; button with this offer. Payment moves over the invoice&apos;s
            existing payment link; acceptance and promises are tracked automatically.
          </p>
        </div>
      ) : null}
    </section>
  )
}
