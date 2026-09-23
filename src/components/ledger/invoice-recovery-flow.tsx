"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Check, Circle, Mail, ShieldCheck, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SettlementCard, type ApprovedOfferSummary } from "@/components/settlements/settlement-card"
import { cn, formatMoney } from "@/lib/utils/format"

type FlowOffer = {
  id: string
  offerCents: number
  expiresAt: string
  status: string
  link?: string
}

type FlowRun = {
  status: string
  currentStep: number
  messagesSent: number
  sequenceName: string | null
}

type EmailPreview = {
  token: string
  recipient: string
  senderName: string
  subject: string
  body: string
  rung: number
  sequenceName: string
  resolveLabel: string | null
  resolutionUrl: string | null
}

export function InvoiceRecoveryFlow({
  invoiceId,
  invoiceNumber,
  currency,
  paid,
  recipient,
  run,
  initialOffer,
}: {
  invoiceId: string
  invoiceNumber: string | null
  currency: string
  paid: boolean
  recipient: string | null
  run: FlowRun | null
  initialOffer: FlowOffer | null
}) {
  const router = useRouter()
  const [offer, setOffer] = useState<FlowOffer | null>(initialOffer)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [preview, setPreview] = useState<EmailPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reviewRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!reviewOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    reviewRef.current?.querySelector<HTMLElement>("button")?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !sending) setReviewOpen(false)
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", closeOnEscape)
    }
  }, [reviewOpen, sending])

  const hasRun = Boolean(run && !["completed"].includes(run.status))
  const canSend = !paid && Boolean(recipient) && hasRun
  const currentRung = Math.max(1, (run?.currentStep ?? 0) + 1)

  function offerApproved(next: ApprovedOfferSummary) {
    setOffer({
      id: next.offerId,
      offerCents: next.offerCents,
      expiresAt: next.expiresAt,
      status: next.status,
      link: next.link,
    })
    setPreview(null)
    setError(null)
    window.setTimeout(() => document.getElementById("send-reminder")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50)
  }

  async function openReview() {
    if (!canSend || loadingPreview) return
    setLoadingPreview(true)
    setError(null)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send/preview`, { method: "POST" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.preview) {
        setError(json?.error ?? "The email preview could not be prepared.")
        return
      }
      setPreview(json.preview as EmailPreview)
      setReviewOpen(true)
    } catch {
      setError("Network error — check your connection and try again.")
    } finally {
      setLoadingPreview(false)
    }
  }

  async function confirmSend() {
    if (!canSend || sending || !preview) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true, previewToken: preview.token }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error ?? "The reminder could not be sent.")
        setReviewOpen(false)
        return
      }
      setSent(true)
      setPreview(null)
      setReviewOpen(false)
      router.refresh()
    } catch {
      setError("Network error — check your connection and try again.")
      setReviewOpen(false)
    } finally {
      setSending(false)
    }
  }

  const stages = [
    { label: "Invoice", done: true, note: "Ready" },
    { label: "Ladder", done: hasRun || paid, note: hasRun ? run?.sequenceName ?? "Attached" : "Needs attention" },
    { label: "Resolve", done: Boolean(offer) || paid, note: offer ? "Attached" : "Optional" },
    { label: paid ? "Paid" : "Email", done: paid || sent || (run?.messagesSent ?? 0) > 0, note: paid ? "Complete" : sent ? "Sent" : "Confirm send" },
  ]

  return (
    <section aria-labelledby="recovery-flow-title" className="rounded-xl border border-hairline bg-surface shadow-ledger">
      <div className="border-b border-hairline p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">Current workflow</div>
            <h2 id="recovery-flow-title" className="mt-1 font-display text-xl tracking-tight text-ink">Recover this invoice</h2>
          </div>
          {paid ? <span className="rounded-full bg-moss-soft px-3 py-1 font-mono text-[11px] text-moss">Complete</span> : null}
        </div>

        <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stages.map((stage, index) => (
            <li key={stage.label} className={cn("rounded-lg border p-3", stage.done ? "border-moss/30 bg-moss-soft/45" : "border-hairline bg-paper")}>
              <div className="flex items-center gap-2">
                <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full", stage.done ? "bg-moss text-white" : "border border-faint text-faint")}>
                  {stage.done ? <Check size={12} aria-hidden /> : <Circle size={9} aria-hidden />}
                </span>
                <span className="text-[13px] font-medium text-ink">{index + 1}. {stage.label}</span>
              </div>
              <p className="mt-1 truncate pl-7 font-mono text-[10px] uppercase tracking-wide text-muted">{stage.note}</p>
            </li>
          ))}
        </ol>
      </div>

      {!paid ? (
        <div className="divide-y divide-hairline">
          <details id="settlement" className="group scroll-mt-24">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4 sm:p-5">
              <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg", offer ? "bg-moss text-white" : "bg-paper text-moss")}>
                {offer ? <Check size={17} aria-hidden /> : <ShieldCheck size={17} aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-ink">{offer ? "Resolve option attached" : "Add a resolve option"}</span>
                <span className="block text-[12px] leading-relaxed text-muted">
                  {offer
                    ? `${formatMoney(offer.offerCents, currency)} will appear as a Resolve button in the next reminder.`
                    : "Optional: let the client accept an offer, promise a date, or report an issue from the email."}
                </span>
              </span>
              <span className="font-mono text-[11px] text-moss group-open:hidden">{offer ? "Review" : "Create"} ↓</span>
              <span className="hidden font-mono text-[11px] text-moss group-open:inline">Close ↑</span>
            </summary>
            <div className="px-4 pb-5 sm:px-5">
              {offer?.link ? (
                <div className="mb-3 rounded-md border border-moss/30 bg-moss-soft p-3 text-[12px] text-moss">
                  Link created and attached. Continue to “Review email” below; you do not need to copy or paste it.
                </div>
              ) : null}
              <SettlementCard invoiceId={invoiceId} onApproved={offerApproved} />
            </div>
          </details>

          <div id="send-reminder" className="scroll-mt-24 p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink text-paper">
                  <Mail size={17} aria-hidden />
                </span>
                <div>
                  <h3 className="text-[14px] font-medium text-ink">Review and send rung {currentRung}</h3>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
                    {recipient
                      ? `To ${recipient} · ${run?.sequenceName ?? "default ladder"}${offer ? " · Resolve button attached" : " · no resolve option"}`
                      : "Add the client's email before sending."}
                  </p>
                </div>
              </div>
              {hasRun ? (
                <div className="flex flex-wrap gap-2">
                  <Link href={`/sequences?attachTo=${encodeURIComponent(invoiceId)}`} className="inline-flex h-10 items-center justify-center rounded-md border border-hairline px-3 text-sm font-medium text-ink hover:border-ink-soft hover:bg-surface focus-ring">Change ladder</Link>
                  <Button type="button" variant="ink" disabled={!canSend || sending || loadingPreview} onClick={openReview}>
                    {loadingPreview ? "Preparing…" : sending ? "Sending…" : "Review email"}
                  </Button>
                </div>
              ) : (
                <Link href={`/sequences?attachTo=${encodeURIComponent(invoiceId)}`} className="inline-flex h-10 items-center justify-center rounded-md border border-hairline px-4 text-sm font-medium text-ink hover:border-ink-soft hover:bg-surface focus-ring">Attach a ladder</Link>
              )}
            </div>
            {sent ? <p className="mt-3 rounded-md bg-moss-soft p-3 text-[13px] text-moss" role="status">Reminder sent. The workflow and timeline have been updated.</p> : null}
            {error ? <p className="mt-3 rounded-md border border-rust/30 bg-rust/10 p-3 text-[13px] text-crimson" role="alert">{error}</p> : null}
          </div>
        </div>
      ) : (
        <p className="p-5 text-sm text-moss">Payment recorded. The ladder is stopped and this workflow is complete.</p>
      )}

      {reviewOpen ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/45 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(e) => {
          if (e.target === e.currentTarget && !sending) setReviewOpen(false)
        }}>
          <div ref={reviewRef} role="dialog" aria-modal="true" aria-labelledby="send-review-title" className="max-h-[92dvh] w-full overscroll-contain overflow-y-auto rounded-t-2xl border border-hairline bg-surface p-5 shadow-2xl sm:max-w-lg sm:rounded-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-moss">Final confirmation</div>
                <h3 id="send-review-title" className="mt-1 font-display text-2xl text-ink">Send this reminder?</h3>
              </div>
              <button type="button" disabled={sending} onClick={() => setReviewOpen(false)} aria-label="Close send review" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-hairline text-muted">
                <X size={17} aria-hidden />
              </button>
            </div>
            <dl className="mt-5 divide-y divide-hairline rounded-lg border border-hairline bg-paper px-4">
              <ReviewRow label="Invoice" value={invoiceNumber ?? "Manual invoice"} />
              <ReviewRow label="From" value={preview?.senderName ?? "—"} />
              <ReviewRow label="Recipient" value={preview?.recipient ?? recipient ?? "Missing email"} />
              <ReviewRow label="Ladder" value={`${preview?.sequenceName ?? run?.sequenceName ?? "Default"} · rung ${preview?.rung ?? currentRung}`} />
              <ReviewRow label="Resolve action" value={preview?.resolveLabel ?? "Not included"} />
            </dl>
            <div className="mt-4 overflow-hidden rounded-lg border border-hairline bg-white">
              <div className="border-b border-hairline px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Subject</div>
                <div className="mt-1 text-[14px] font-medium text-ink">{preview?.subject ?? "Preparing preview…"}</div>
              </div>
              <div tabIndex={0} aria-label="Scrollable email preview" className="max-h-[min(52dvh,34rem)] overflow-y-scroll overscroll-contain whitespace-pre-wrap px-4 py-4 text-[13px] leading-relaxed text-ink-soft">
                {preview?.body ?? ""}{preview?.resolveLabel ? <div className="mt-5 rounded-md bg-moss px-4 py-3 text-center text-sm font-medium text-white">{preview.resolveLabel}</div> : null}
              </div>
            </div>
            {!preview?.resolveLabel ? (
              <p className="mt-3 text-[12px] leading-relaxed text-muted">This reminder can be sent without a resolve option. Close this window and create one first if you want the Resolve button included.</p>
            ) : null}
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" disabled={sending} onClick={() => setReviewOpen(false)}>Go back</Button>
              <Button type="button" variant="moss" disabled={sending || !preview} onClick={confirmSend}>{sending ? "Sending…" : "Confirm exact email & send"}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-[13px]">
      <dt className="text-muted">{label}</dt>
      <dd className="max-w-[65%] break-words text-right font-medium text-ink">{value}</dd>
    </div>
  )
}
