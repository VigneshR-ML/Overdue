import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth/session"
import { computeClientPaymentScores, getAgingTotals, getUrgencyQueue } from "@/lib/db/queries"
import { formatMoney } from "@/lib/utils/format"
import { Card, CardHeader, CardBody } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"

export const metadata = { title: "Insights" }

export const dynamic = "force-dynamic"

export default async function InsightsPage() {
  const session = await getSessionUser()
  if (!session) redirect("/?signin=1")

  const [scores, totals, queue] = await Promise.all([
    computeClientPaymentScores(session.id),
    getAgingTotals(session.id),
    getUrgencyQueue(session.id, 100),
  ])

  const atRisk = scores.filter((c) => c.avgDays !== null && c.avgDays > 21)
  const slow = scores.filter((c) => c.avgDays !== null && c.avgDays > 7 && c.avgDays <= 21)
  const healthy = scores.filter((c) => c.avgDays !== null && c.avgDays <= 7)

  const maxOutstanding = Math.max(1, ...queue.map((q) => q.invoice.amount_cents - q.invoice.paid_cents))

  return (
    <div className="space-y-5">
      <header>
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Under the hood</div>
        <h1 className="mt-1 font-display text-3xl tracking-tight text-ink">Insights</h1>
        <p className="mt-1 text-sm text-muted">
          Who pays on time, who doesn't, and what that costs you. Based on your real ledger.
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
      </div>

      <p className="font-mono text-[11px] text-faint">
        Tighter circles = fewer emails. The ladder auto-pauses the moment a client replies.
      </p>
    </div>
  )
}