import Link from "next/link"
import { cn, formatMoney, formatDate } from "@/lib/utils/format"
import type { RecoveryQueueItem } from "@/lib/db/queries"
import type { RiskBand } from "@/lib/analysis/risk"
import type { NextActionKind } from "@/lib/analysis/next-action"

/**
 * Today's recovery queue — open invoices sorted by AI risk score, each with
 * its explainable score (factors live behind the chip), the next-best action
 * and the "why", plus the predicted payment date when we have a signal.
 */
const BAND_STYLE: Record<RiskBand, { dot: string; chip: string; label: string }> = {
  low: { dot: "bg-moss", chip: "border-moss/30 bg-moss-soft text-moss", label: "Low risk" },
  medium: { dot: "bg-brass", chip: "border-brass/30 bg-brass/10 text-ember", label: "Medium risk" },
  high: { dot: "bg-rust", chip: "border-rust/30 bg-rust/10 text-rust", label: "High risk" },
  critical: { dot: "bg-crimson", chip: "border-crimson/30 bg-crimson/10 text-crimson", label: "Critical" },
}

const ACTION_LABEL: Record<NextActionKind, string> = {
  review_dispute: "Resolve dispute",
  manual_review: "Needs a human",
  escalate: "Escalate",
  follow_up: "Follow up",
  wait_promise: "Wait on promise",
  nothing: "On autopilot",
}

export function RecoveryQueue({ items }: { items: RecoveryQueueItem[] }) {
  if (!items.length) return null

  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-ledger">
      <div className="border-b border-hairline bg-paper/60 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        Today&rsquo;s queue <span className="text-faint">/ scored by risk, decided by rules</span>
      </div>
      <ul className="divide-y divide-hairline">
        {items.map(({ invoice, risk, next, predicted, overdueDays }) => {
          const band = BAND_STYLE[risk.band]
          return (
            <li key={invoice.id} className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 transition-colors duration-150 hover:bg-paper/50">
              <div className="min-w-0 flex-1 basis-52">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">
                    {invoice.client?.name ?? "Unknown client"}
                  </span>
                  {invoice.number ? <span className="font-mono text-[11px] text-faint">#{invoice.number}</span> : null}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted">
                  <span>{formatMoney(invoice.amount_cents, invoice.currency)}</span>
                  <span>·</span>
                  <span>{overdueDays > 0 ? `${overdueDays}d overdue` : `due ${formatDate(invoice.due_date)}`}</span>
                  {predicted ? (
                    <>
                      <span>·</span>
                      <span title={predicted.basis === "history" ? "based on this client's average" : predicted.basis === "promise" ? "client commit" : "by due date"}>
                        <span className="text-faint">pays ~</span> {formatDate(predicted.date)}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>

              <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px]", band.chip)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", band.dot)} />
                {risk.score}
                <span className="hidden sm:inline">{band.label}</span>
              </div>

              <Link
                href={`/invoices?focus=${encodeURIComponent(invoice.id)}`}
                className={cn(
                  "max-w-56 rounded-md border px-3 py-1.5 text-left text-[12px] leading-snug transition-colors",
                  next.priority === 0
                    ? "border-crimson/30 bg-crimson/5 text-crimson hover:bg-crimson/10"
                    : next.priority === 1
                      ? "border-rust/30 bg-rust/5 text-rust hover:bg-rust/10"
                      : "border-moss/30 bg-moss-soft text-moss hover:bg-moss",
                )}
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-70">
                  {ACTION_LABEL[next.kind]}
                </span>
                <span className="block text-[12px]">{next.reason}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}