"use client"

import { formatMoney, formatMoneyShort } from "@/lib/utils/format"
import type { CurrencyAgingTotals } from "@/types"
import { cn } from "@/lib/utils/format"

/**
 * Dashboard aging strip — one ledger row of real money. Amounts count up on
 * load and re-count when the values change (e.g. a payment webhook arrives).
 */
export function AgingStrip({ totals }: { totals: CurrencyAgingTotals[] }) {
  if (totals.length === 0) return null

  return (
    <div className="space-y-3">
      {totals.map((total) => {
        const cells = [
          { label: "Collected this month", value: total.collected_month_cents, tone: "moss", key: "collected" },
          { label: "Due soon (7 days)", value: total.due_soon_cents, tone: "brass", key: "duesoon" },
          { label: "Overdue", value: total.overdue_cents, tone: "rust", key: "overdue" },
          { label: "Total outstanding", value: total.outstanding_total_cents, tone: "ink", key: "outstanding" },
        ]
        return (
          <section key={total.currency} aria-label={`${total.currency} ledger totals`}>
            {totals.length > 1 ? <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{total.currency} ledger</div> : null}
            <div className={cn("grid grid-cols-1 divide-y divide-hairline rounded-lg border border-hairline bg-surface shadow-ledger sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-y-0")}>
              {cells.map((c) => {
                const accent = c.tone === "moss" ? "text-moss" : c.tone === "rust" ? "text-rust" : c.tone === "brass" ? "text-ember" : "text-ink"
                return (
                  <div key={c.key} className="px-5 py-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{c.label}</div>
                    <div className={cn("count-up mt-1.5 font-mono text-[26px] leading-none tabular-nums sm:text-3xl", accent)}>
                      {formatMoney(c.value, total.currency)}
                    </div>
                    <div className="mt-1.5 font-mono text-[11px] text-faint">{formatMoneyShort(c.value, total.currency)} / open ledger</div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
