import Link from "next/link"
import { formatMoney, formatDate } from "@/lib/utils/format"
import type { Invoice, Client } from "@/types"
import { OverdueBadge, PaidBadge, SentBadge } from "@/components/ui/badge"
import { cn } from "@/lib/utils/format"

/**
 * The urgency queue — invoices sorted by degree-of-lateness, rendered as a
 * ledger. Rows carry the temperature badge of their own overdue state.
 */
export function UrgencyQueue({
  items,
}: {
  items: { invoice: Invoice & { client: Client | null }; overdueDays: number }[]
}) {
  if (!items.length) return null

  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-ledger">
      <div className="border-b border-hairline bg-paper/60 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        Payment queue <span className="text-faint">/ sorted by heat</span>
      </div>
      <ul className="divide-y divide-hairline">
        {items.map(({ invoice, overdueDays }) => {
          const isPaid = invoice.status === "paid" || Boolean(invoice.paid_at)
          const partiallyPaid = invoice.status === "partially_paid"
          return (
            <li
              key={invoice.id}
              className={cn(
                "group flex items-center gap-4 px-5 py-3 transition-colors duration-150 hover:bg-paper/50",
                isPaid && "paid-flash",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">
                    {invoice.client?.name ?? "Unknown client"}
                  </span>
                  {invoice.number ? (
                    <span className="font-mono text-[11px] text-faint">#{invoice.number}</span>
                  ) : null}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted">
                  <span>{invoice.provider}</span>
                  <span>·</span>
                  <span>due {formatDate(invoice.due_date)}</span>
                  {partiallyPaid ? (
                    <>
                      <span>·</span>
                      <span className="font-mono text-ember">
                        {formatMoney(invoice.paid_cents, invoice.currency)} paid
                      </span>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="hidden items-center gap-2 sm:flex">
                {isPaid ? (
                  <PaidBadge />
                ) : overdueDays > 0 ? (
                  <OverdueBadge days={overdueDays} />
                ) : (
                  <SentBadge />
                )}
              </div>

              <div className="w-28 text-right">
                <div
                  className={cn(
                    "money text-[15px] font-medium tabular-nums",
                    isPaid ? "text-moss" : overdueDays > 14 ? "text-crimson" : "text-ink",
                  )}
                >
                  {formatMoney(invoice.amount_cents, invoice.currency)}
                </div>
              </div>

              <Link
                href={`/invoices?focus=${encodeURIComponent(invoice.id)}`}
                className="rounded border border-hairline px-2.5 py-1 text-[12px] text-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:border-ink-soft hover:text-ink"
              >
                View
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}