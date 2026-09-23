"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronRight, ClipboardList, Mail, MessageSquare, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PaymentPlanRequest } from "@/components/ledger/payment-plan-request"
import { ReplyThread } from "@/components/ledger/reply-thread"
import { formatDate, formatMoney } from "@/lib/utils/format"
import type { InvoiceDetailRow } from "@/lib/db/queries"

type DetailProps = Pick<InvoiceDetailRow, "paymentPlans" | "planLedger" | "replies" | "disputes" | "messages" | "workflowEvents">

function planStatusLabel(status: string | null | undefined) {
  const value = String(status ?? "unknown").replace(/_/g, " ")
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * Keeps the ledger screen focused on the next action. The full audit trail is
 * deliberately one click away, in an accessible scrollable dialog.
 */
export function InvoiceDetailedView({
  invoiceNumber,
  currency,
  ...detail
}: DetailProps & {
  invoiceNumber: string | null
  currency: string
}) {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const priorOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = priorOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const latestPlan = detail.planLedger[0] ?? null

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="gap-2">
        <ClipboardList size={16} aria-hidden /> Detailed view
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}
        >
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="invoice-detail-title" className="max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-2xl border border-hairline bg-surface shadow-2xl sm:max-w-3xl sm:rounded-xl">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-hairline bg-surface/95 p-5 backdrop-blur">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-moss">Invoice activity</div>
                <h2 id="invoice-detail-title" className="mt-1 font-display text-2xl text-ink">{invoiceNumber ? `Invoice ${invoiceNumber}` : "Invoice details"}</h2>
                <p className="mt-1 text-[13px] text-muted">One clear record of what happened, what is paused, and what happens next.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close detailed view" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-hairline text-muted hover:bg-paper">
                <X size={17} aria-hidden />
              </button>
            </header>

            <div className="space-y-5 p-5">
              {detail.workflowEvents.length ? (
                <section className="rounded-lg border border-hairline bg-paper p-4">
                  <h3 className="font-medium text-ink">Recorded workflow events</h3>
                  <ul className="mt-3 divide-y divide-hairline">
                    {detail.workflowEvents.slice(0, 20).map((event) => (
                      <li key={event.id} className="flex items-start justify-between gap-4 py-2.5 text-[13px]">
                        <span className="text-ink">{planStatusLabel(event.event_type)}</span>
                        <span className="shrink-0 font-mono text-[11px] text-faint">{formatDate(event.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {detail.paymentPlans.length ? (
                <section className="space-y-3">
                  <div className="flex items-center gap-2"><ChevronRight size={16} className="text-moss" aria-hidden /><h3 className="font-medium text-ink">Payment-plan requests</h3></div>
                  {detail.paymentPlans.map((request) => <PaymentPlanRequest key={request.id} request={request} currency={currency} />)}
                </section>
              ) : null}

              {latestPlan ? (
                <section className="rounded-lg border border-hairline bg-paper p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-medium text-ink">Payment schedule</h3>
                    <span className="font-mono text-[11px] text-muted">{planStatusLabel(latestPlan.status)}</span>
                  </div>
                  <p className="mt-1 text-[13px] text-muted">{latestPlan.installment_count} {latestPlan.frequency} payments from {formatDate(latestPlan.starts_on)} · {formatMoney(latestPlan.total_cents, latestPlan.currency)}</p>
                  <div className="mt-3 max-h-56 divide-y divide-hairline overflow-y-auto rounded-md border border-hairline">
                    {latestPlan.plan_installments.slice().sort((a, b) => a.sequence_no - b.sequence_no).map((installment) => (
                      <div key={installment.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                        <span>Installment {installment.sequence_no} · {formatDate(installment.due_date)} · {planStatusLabel(installment.status)}</span>
                        <span className="font-mono text-ink">{formatMoney(installment.amount_cents, latestPlan.currency)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {detail.replies.length || detail.disputes.length ? <ReplyThread replies={detail.replies} disputes={detail.disputes} /> : null}

              {detail.messages.length ? (
                <section className="rounded-lg border border-hairline bg-paper p-4">
                  <div className="flex items-center gap-2"><Mail size={16} className="text-moss" aria-hidden /><h3 className="font-medium text-ink">Email history · {detail.messages.length}</h3></div>
                  <ul className="mt-3 divide-y divide-hairline">
                    {detail.messages.map((message) => (
                      <li key={message.id} className="py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><span className="text-[14px] font-medium text-ink">{message.subject}</span><span className="font-mono text-[11px] text-faint">{formatDate(message.sent_at)} · rung {message.step}</span></div>
                        <div tabIndex={0} className="mt-1.5 max-h-40 overflow-y-auto overscroll-contain whitespace-pre-line pr-2 text-[13px] leading-relaxed text-muted">{message.body}</div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {detail.replies.length ? <p className="flex items-center gap-2 text-[12px] text-muted"><MessageSquare size={14} aria-hidden /> Reply classifications are visible alongside the original client message so they can be checked by a person.</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
