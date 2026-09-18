import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth/session"
import { getInvoiceDetail } from "@/lib/db/queries"
import { formatMoney, formatDate, cn } from "@/lib/utils/format"
import { PaidBadge, OverdueBadge, SentBadge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardBody } from "@/components/ui/card"
import { PageHeader } from "@/components/app-shell/page-header"
import { SettlementCard } from "@/components/settlements/settlement-card"
import { ReplyThread } from "@/components/ledger/reply-thread"
import { RecoveryTimeline } from "@/components/ledger/recovery-timeline"
import { buildInvoiceTimeline, type TimelineRun } from "@/lib/onboarding/timeline"
import { ArrowLeft, CheckCircle2 } from "lucide-react"

export const metadata = { title: "Invoice" }

export const dynamic = "force-dynamic"

export default async function InvoiceDetailPage({
  params,
}: {
  params: { invoiceId: string }
}) {
  const session = await getSessionUser()
  if (!session) redirect("/?signin=1")

  const row = await getInvoiceDetail(session.id, params.invoiceId)
  if (!row) redirect("/invoices")

  const { invoice } = row
  const paid = invoice.status === "paid" || Boolean(invoice.paid_at)
  const balance = Math.max(0, invoice.amount_cents - invoice.paid_cents)
  const days = invoice.due_date
    ? Math.ceil((new Date(invoice.due_date + "T12:00:00").getTime() - Date.now()) / 86400000)
    : 0

  const run = row.runs[0] ?? null
  const lastMessage = row.messages[0] ?? null
  const latestReply = row.replies[0] ?? null
  const promiseDate = run?.promise_date && new Date(run.promise_date).getTime() > Date.now() ? run.promise_date : null

  const milestones = buildInvoiceTimeline({
    created_at: invoice.created_at,
    clientEmail: invoice.client?.billing_email ?? invoice.client?.email ?? null,
    run: run
      ? ({
          status: run.status,
          next_run_at: run.next_run_at,
          last_sent_at: run.last_sent_at,
          messages_sent: run.messages_sent,
          sequenceName: run.sequenceName,
          promise_date: run.promise_date,
          promise_missed: run.promise_missed,
          reply_classification: run.reply_classification,
        } satisfies TimelineRun)
      : null,
    lastMessage: lastMessage ? { sent_at: lastMessage.sent_at, opened_at: lastMessage.opened_at } : null,
    lastReply: latestReply ? { classification: latestReply.classification, created_at: latestReply.created_at } : null,
    promiseDate,
    promiseMissed: Boolean(run?.promise_missed),
    disputeOpen: row.disputes.length > 0,
    paidAt: invoice.paid_at,
    paidCents: invoice.paid_cents,
    amountCents: invoice.amount_cents,
  })

  return (
    <div className="space-y-6">
      <div>
        <Link href="/invoices" className="inline-flex items-center gap-1.5 font-mono text-[12px] text-moss hover:text-moss-bright">
          <ArrowLeft size={13} aria-hidden /> Back to the ledger
        </Link>
        <PageHeader
          kicker={invoice.provider === "manual" ? "Manual invoice" : `${invoice.provider} · ${invoice.number ?? ""}`}
          title={invoice.client?.name ?? "Unknown client"}
          description={
            invoice.client?.billing_email
              ? invoice.client.billing_email
              : "No client email on file — reminders can't be sent until one is added."
          }
          action={
            paid ? (
              <PaidBadge />
            ) : days < 0 ? (
              <OverdueBadge days={-days} />
            ) : (
              <SentBadge />
            )
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Financial summary */}
        <Card>
          <CardHeader>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Invoice overview</span>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] text-muted">Total</span>
              <span className={cn("money text-[20px] font-medium tabular-nums", paid ? "text-moss" : "text-ink")}>
                {formatMoney(invoice.amount_cents, invoice.currency)}
              </span>
            </div>
            {!paid && invoice.amount_cents !== invoice.paid_cents ? (
              <div className="flex items-baseline justify-between border-t border-hairline pt-2">
                <span className="text-[13px] text-muted">Recorded payments</span>
                <span className="font-mono text-[14px] text-moss">{formatMoney(invoice.paid_cents, invoice.currency)}</span>
              </div>
            ) : null}
            {!paid ? (
              <div className="flex items-baseline justify-between border-t border-hairline pt-2">
                <span className="text-[13px] text-muted">Still owed</span>
                <span className={cn("money text-[16px] font-medium tabular-nums", days < -14 ? "text-crimson" : "text-ink")}>
                  {formatMoney(balance, invoice.currency)}
                </span>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between border-t border-hairline pt-2">
              <span className="text-[13px] text-muted">Issued</span>
              <span className="font-mono text-[13px] text-ink-soft">{formatDate(invoice.issue_date)}</span>
            </div>
            <div className="flex items-baseline justify-between border-t border-hairline pt-2">
              <span className="text-[13px] text-muted">Due</span>
              <span className="font-mono text-[13px] text-ink-soft">
                {formatDate(invoice.due_date)}
                {!paid && days < 0 ? <span className="text-crimson"> · {Math.abs(days)}d overdue</span> : null}
              </span>
            </div>
            {paid ? (
              <div className="flex items-baseline justify-between border-t border-hairline pt-2">
                <span className="text-[13px] text-muted">Paid</span>
                <span className="font-mono text-[13px] text-moss">{formatDate(invoice.paid_at)}</span>
              </div>
            ) : null}
            {invoice.payment_url ? (
              <div className="border-t border-hairline pt-2">
                <div className="text-[13px] text-muted">Client payment link</div>
                <a href={invoice.payment_url} target="_blank" rel="noreferrer" className="mt-0.5 block break-all font-mono text-[12px] text-moss hover:underline">
                  {invoice.payment_url}
                </a>
              </div>
            ) : null}
            {!paid && run ? (
              <div className="rounded-md border border-hairline bg-paper p-3 text-[13px] text-muted">
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-faint">Next follow-up · </span>
                {run.status === "paused" ? (
                  <span>paused by you — resume from the ledger.</span>
                ) : run.next_run_at ? (
                  <>
                    scheduled for <span className="font-medium text-ink">{formatDate(run.next_run_at)}</span>.
                    <Link href={`/invoices?focus=${invoice.id}`} className="ml-1 text-moss hover:underline">Send now instead →</Link>
                  </>
                ) : (
                  <span>queued — it will be scheduled after the current step is sent.</span>
                )}
              </div>
            ) : null}
          </CardBody>
        </Card>

        {/* Recovery timeline */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Recovery timeline</span>
            <span className="font-mono text-[11px] text-faint">{run?.sequenceName ? `${run.sequenceName} ladder` : "no ladder"}</span>
          </CardHeader>
          <CardBody>
            {milestones.length ? (
              <RecoveryTimeline milestones={milestones} />
            ) : (
              <p className="text-sm text-muted">Nothing tracked for this invoice yet.</p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Settlement — anchor target for the ledger's "Settle" action */}
      <div id="settlement" className={cn("scroll-mt-24", !paid && balance > 0 ? "" : "hidden")}>
        {!paid && balance > 0 ? (
          <details open>
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-moss/40 bg-surface px-5 py-4 shadow-ledger">
              <CheckCircle2 size={16} className="text-moss" aria-hidden />
              <span className="font-display text-lg text-ink">Settlement offer</span>
              <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.12em] text-muted">optional</span>
            </summary>
            <SettlementCard invoiceId={invoice.id} />
          </details>
        ) : null}
      </div>

      {/* Replies / disputes */}
      {row.replies.length || row.disputes.length ? (
        <ReplyThread replies={row.replies} disputes={row.disputes} />
      ) : null}

      {/* Message history */}
      {row.messages.length > 0 ? (
        <Card>
          <CardHeader>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Reminder history · {row.messages.length}</span>
          </CardHeader>
          <CardBody>
            <ul className="divide-y divide-hairline">
              {row.messages.map((m) => (
                <li key={m.id} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-[14px] font-medium text-ink">{m.subject}</span>
                    <span className="font-mono text-[11px] text-faint">
                      {formatDate(m.sent_at)} · rung {m.step} {m.opened_at ? "· opened" : "· not opened yet"}
                    </span>
                  </div>
                  <div className="mt-1.5 max-h-24 overflow-hidden whitespace-pre-line text-[13px] leading-relaxed text-muted">
                    {m.body}
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link href={`/invoices?focus=${invoice.id}`}>
          <Button variant="outline">Open in ledger</Button>
        </Link>
        {!paid ? (
          <Link href={`/invoices?focus=${invoice.id}`}>
            <Button>Mark paid / manage reminders</Button>
          </Link>
        ) : null}
      </div>
    </div>
  )
}