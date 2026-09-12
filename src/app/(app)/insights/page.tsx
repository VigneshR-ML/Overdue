import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth/session"
import { computeClientPaymentScores, getUrgencyQueue, getInsights, getRecoveryQueue } from "@/lib/db/queries"
import { formatMoney, formatDate } from "@/lib/utils/format"
import { Card, CardHeader, CardBody } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils/format"

export const metadata = { title: "Insights" }

export const dynamic = "force-dynamic"

const BUCKET_COLOR: Record<string, string> = {
  current: "#2F5D50",
  b0_30: "#C29A43",
  b31_60: "#D9792B",
  b61_90: "#C14E2B",
  b90: "#9E2A23",
}

const BUCKET_LABEL: Record<string, string> = {
  current: "Current",
  b0_30: "1–30 days",
  b31_60: "31–60 days",
  b61_90: "61–90 days",
  b90: "90+ days",
}

export default async function InsightsPage() {
  const session = await getSessionUser()
  if (!session) redirect("/?signin=1")

  const [scores, queue, snap, recovery] = await Promise.all([
    computeClientPaymentScores(session.id),
    getUrgencyQueue(session.id, 100),
    getInsights(session.id),
    getRecoveryQueue(session.id, 100),
  ])

  const atRisk = scores.filter((c) => c.avgDays !== null && c.avgDays > 21)
  const slow = scores.filter((c) => c.avgDays !== null && c.avgDays > 7 && c.avgDays <= 21)
  const healthy = scores.filter((c) => c.avgDays !== null && c.avgDays <= 7)

  const maxOutstanding = Math.max(1, ...queue.map((q) => q.invoice.amount_cents - q.invoice.paid_cents))
  const maxBucket = Math.max(1, snap.aging.current, snap.aging.b0_30, snap.aging.b31_60, snap.aging.b61_90, snap.aging.b90)

  const riskCounts = { low: 0, medium: 0, high: 0, critical: 0 }
  for (const r of recovery) riskCounts[r.risk.band] += 1
  const riskTotal = Math.max(1, recovery.length)

  return (
    <div className="space-y-5">
      <header>
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Under the hood</div>
        <h1 className="mt-1 font-display text-3xl tracking-tight text-ink">Insights</h1>
        <p className="mt-1 text-sm text-muted">
          Who pays on time, who doesn't, what that costs you — and what the ledger says is coming next.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">On-time payers</span></CardHeader>
          <CardBody><div className="font-display text-3xl text-moss">{healthy.length}</div><div className="mt-1 text-[12px] text-muted">clients within 7 days of due</div></CardBody>
        </Card>
        <Card>
          <CardHeader><span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Slow payers</span></CardHeader>
          <CardBody><div className="font-display text-3xl text-ember">{slow.length}</div><div className="mt-1 text-[12px] text-muted">8–21 days late on average</div></CardBody>
        </Card>
        <Card>
          <CardHeader><span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">At risk</span></CardHeader>
          <CardBody>
            <div className="font-display text-3xl text-crimson">{atRisk.length}</div>
            <div className="mt-1 text-[12px] text-muted">21+ days late on average — best on a Fast Cash ladder</div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Days sales outstanding</span>
            <span className="font-mono text-[11px] text-faint">last 90 days of collections</span>
          </CardHeader>
          <CardBody>
            <div className="flex items-end justify-between">
              <div>
                <div className="font-display text-4xl text-ink">{snap.dso.days > 0 ? snap.dso.days.toFixed(0) : "—"}</div>
                <div className="mt-1 text-[12px] text-muted">
                  {snap.dso.days <= 30 ? "Tight book — money in quickly." : snap.dso.days <= 60 ? "Normal for a small ledger — worth watching." : "Slow book — invoicing converts slowly."}
                </div>
              </div>
              {snap.aging.count > 0 && (
                <div className="text-right">
                  <div className={cn("font-mono text-[22px]", snap.aging.pctOverdue > 50 ? "text-crimson" : "text-ink")}>{snap.aging.pctOverdue}%</div>
                  <div className="text-[12px] text-muted">of outstanding is past due</div>
                </div>
              )}
            </div>
            <div className="mt-4 space-y-2">
              {(["current", "b0_30", "b31_60", "b61_90", "b90"] as const).map((k) => (
                <div key={k}>
                  <div className="flex items-baseline justify-between font-mono text-[12px]">
                    <span className="text-muted">{BUCKET_LABEL[k]}</span>
                    <span className="text-ink-soft">{formatMoney(snap.aging[k])}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-hairline">
                    <div className="h-full rounded-full" style={{ width: `${(snap.aging[k] / maxBucket) * 100}%`, background: BUCKET_COLOR[k] }} />
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Cash forecast</span>
            <span className="font-mono text-[11px] text-faint">expected payments, next 3 months</span>
          </CardHeader>
          <CardBody className="space-y-4">
            {snap.forecast.every((m) => m.items.length === 0) ? (
              <EmptyState title="No expected payments" description="Open invoices with a due date or promise will appear here as a predicted month." className="border-0" />
            ) : (
              snap.forecast.map((m) => {
                const total = m.bucket.high + m.bucket.medium + m.bucket.atRisk
                if (total === 0) return null
                return (
                  <div key={m.month}>
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                        {formatDate(`${m.month}-01`)}
                      </span>
                      <span className="money text-[15px] font-medium tabular-nums text-ink">{formatMoney(total)}</span>
                    </div>
                    <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-hairline">
                      <div className="h-full bg-moss" style={{ width: `${(m.bucket.high / total) * 100}%` }} />
                      <div className="h-full bg-brass" style={{ width: `${(m.bucket.medium / total) * 100}%` }} />
                      <div className="h-full bg-rust" style={{ width: `${(m.bucket.atRisk / total) * 100}%` }} />
                    </div>
                    <div className="mt-1 flex gap-4 font-mono text-[11px] text-muted">
                      <span><span className="text-moss">{formatMoney(m.bucket.high)}</span> promised/steady</span>
                      <span><span className="text-ember">{formatMoney(m.bucket.medium)}</span> likely</span>
                      <span><span className="text-rust">{formatMoney(m.bucket.atRisk)}</span> at risk</span>
                    </div>
                  </div>
                )
              })
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Outstanding, by invoice</span>
            <span className="font-mono text-[11px] text-faint">sorted by heat</span>
          </CardHeader>
          <CardBody className="space-y-2.5">
            {queue.length === 0 ? (
              <p className="text-sm text-muted">Nothing outstanding. Beautiful.</p>
            ) : (
              queue.slice(0, 8).map(({ invoice, overdueDays }) => {
                const balance = Math.max(0, invoice.amount_cents - invoice.paid_cents)
                const color = overdueDays > 14 ? "#9E2A23" : overdueDays > 0 ? "#C14E2B" : "#C29A43"
                return (
                  <div key={invoice.id}>
                    <div className="flex items-baseline justify-between font-mono text-[12px]">
                      <span className="truncate text-ink-soft">{invoice.client?.name ?? "—"}</span>
                      <span className="text-muted">{formatMoney(balance, invoice.currency)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-hairline">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(4, (balance / maxOutstanding) * 100)}%`, background: color }} />
                    </div>
                  </div>
                )
              })
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Where the risk lives</span>
            <span className="font-mono text-[11px] text-faint">by AI risk band</span>
          </CardHeader>
          <CardBody className="space-y-3">
            {recovery.length === 0 ? (
              <p className="text-sm text-muted">Nothing being chased right now.</p>
            ) : (
              <>
                {(["critical", "high", "medium", "low"] as const).map((b) => {
                  const n = riskCounts[b]
                  if (n === 0) return null
                  const color = b === "critical" ? "#9E2A23" : b === "high" ? "#C14E2B" : b === "medium" ? "#C29A43" : "#2F5D50"
                  return (
                    <div key={b}>
                      <div className="flex items-baseline justify-between font-mono text-[12px]">
                        <span className="capitalize text-ink-soft">{b} · {n} invoice{n === 1 ? "" : "s"}</span>
                        <span className="text-muted">{Math.round((n / riskTotal) * 100)}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-hairline">
                        <div className="h-full rounded-full" style={{ width: `${(n / riskTotal) * 100}%`, background: color }} />
                      </div>
                    </div>
                  )
                })}
              </>
            )}
            <p className="pt-1 font-mono text-[11px] text-faint">
              Every score is explainable — click any invoice in the dashboard queue to see its factors.
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Payment behavior</span>
            <span className="font-mono text-[11px] text-faint">days late, avg</span>
          </CardHeader>
          <CardBody>
            {scores.length === 0 ? (
              <EmptyState title="Connect invoices to see behavior" description="Your clients' payment history shows up here once invoices sync." className="border-0" />
            ) : (
              <ul className="divide-y divide-hairline">
                {scores.slice(0, 10).map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium text-ink">{c.name}</div>
                      <div className="font-mono text-[11px] text-faint">score {c.score}</div>
                    </div>
                    <span className={`font-mono text-[13px] ${c.avgDays !== null && c.avgDays > 21 ? "text-crimson" : c.avgDays !== null && c.avgDays > 7 ? "text-ember" : "text-moss"}`}>
                      {c.avgDays === null ? "—" : c.avgDays > 0 ? `${c.avgDays}d late` : `${c.avgDays}d early`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Fast cash</span>
            <span className="font-mono text-[11px] text-faint">the next 90 days, best case</span>
          </CardHeader>
          <CardBody>
            {snap.forecast.every((m) => m.items.length === 0) ? (
              <EmptyState title="Nothing to speed up yet" description="Once invoices are open with due dates, this shows what a tight collections push would realistically pull in." className="border-0" />
            ) : (
              <ul className="divide-y divide-hairline">
                {snap.forecast[1]?.items.slice(0, 6).map((i) => {
                  const bg = i.bucket === "high" ? "text-moss" : i.bucket === "medium" ? "text-ember" : "text-rust"
                  return (
                    <li key={i.invoiceId} className="flex items-center justify-between py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-medium text-ink">{i.date ? `expected ${formatDate(i.date)}` : "next month"}</div>
                        <div className="font-mono text-[11px] text-faint">{i.reason}</div>
                      </div>
                      <span className={cn("font-mono text-[13px]", bg)}>{formatMoney(i.amountCents)}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <p className="font-mono text-[11px] text-faint">
        Tighter circles = fewer emails. The ladder auto-pauses the moment a client replies.
      </p>
    </div>
  )
}