"use client"

import { useEffect, useState } from "react"
import { formatMoney, formatMoneyShort } from "@/lib/utils/format"
import type { AgingTotals } from "@/types"
import { cn } from "@/lib/utils/format"

/**
 * Dashboard aging strip — one ledger row of real money. Amounts count up on
 * load and re-count when the values change (e.g. a payment webhook arrives).
 */
export function AgingStrip({ totals }: { totals: AgingTotals }) {
  const [prev, setPrev] = useState(totals)
  const changed = prev.collected_month_cents !== totals.collected_month_cents

  useEffect(() => {
    if (changed) setPrev(totals)
  }, [totals, changed])

  const cells = [
    { label: "Collected this month", value: totals.collected_month_cents, tone: "moss", key: "collected" },
    { label: "Due soon (7 days)", value: totals.due_soon_cents, tone: "brass", key: "duesoon" },
    { label: "Overdue", value: totals.overdue_cents, tone: "rust", key: "overdue" },
    { label: "Total outstanding", value: totals.outstanding_total_cents, tone: "ink", key: "outstanding" },
  ]

  return (
    <div className={cn("grid grid-cols-1 divide-y divide-hairline rounded-lg border border-hairline bg-surface shadow-ledger sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-y-0")}>
      {cells.map((c) => {
        const isMoss = c.tone === "moss"
        const isRust = c.tone === "rust"
        const isBrass = c.tone === "brass"
        const accent = isMoss ? "text-moss" : isRust ? "text-rust" : isBrass ? "text-ember" : "text-ink"
        return (
          <div key={c.key} className="px-5 py-4">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{c.label}</div>
            <div className={cn("count-up mt-1.5 font-mono text-[26px] leading-none tabular-nums sm:text-3xl", accent)}>
              {formatMoney(c.value)}
            </div>
            <div className="mt-1.5 text-[11px] font-mono text-faint">{formatMoneyShort(c.value)} / open ledger</div>
          </div>
        )
      })}
    </div>
  )
}