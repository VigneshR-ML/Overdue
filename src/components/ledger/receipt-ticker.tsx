"use client"

import { useEffect, useState } from "react"
import { buildTicker, type TickerRow } from "@/lib/utils/receipt-ticker"

/**
 * Receipt ticker — the landing hero's animated product demo. A mini ledger
 * renders fake invoices aging; on "today" they flip to paid with a moss flash.
 * Implemented client-side so the demo actually animates without any backend.
 */
export function ReceiptTicker() {
  const [rows, setRows] = useState<TickerRow[]>([])
  const [day, setDay] = useState(0)

  useEffect(() => {
    setRows(buildTicker())
    const iv = setInterval(() => setDay((d) => d + 1), 1600)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="mx-auto w-full max-w-md rounded-lg border border-hairline bg-surface p-5 shadow-ledger">
      <div className="flex items-center justify-between border-b border-hairline pb-3">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Receipt ledger</div>
        <div className="font-mono text-[11px] text-faint">local · autopilot</div>
      </div>

<ul className="divide-y divide-hairline" aria-hidden="true">
          {rows.map((r) => {
            const paid = day >= 3
            const overdue = r.daysLate > 0 && !paid
            const toneColor = r.daysLate > 21 ? "#9E2A23" : r.daysLate > 14 ? "#C14E2B" : r.daysLate > 7 ? "#D9792B" : r.daysLate > 0 ? "#C29A43" : "#A7A091"
            return (
              <li key={r.id} className="flex items-center gap-3 py-3 transition-colors duration-500">
                <span
                  className="inline-block h-2 w-2 rounded-full transition-all duration-500"
                  style={{ background: paid ? "#2F5D50" : toneColor }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink">{r.client}</div>
                  <div className="font-mono text-[11px] text-faint">
                    #{r.invoice} · {paid ? "settled today" : overdue ? `day ${r.daysLate} of ladder · ${r.tone}` : `due ${r.daysToDue}d`}
                  </div>
                </div>
                <div className="font-mono text-[14px] tabular-nums">
                  <span className={paid ? "text-moss" : "text-ink"}>
                    {r.amount}
                  </span>
                </div>
              <span
                className="font-mono text-[10px] uppercase tracking-wider"
                style={{ color: paid ? "#2F5D50" : toneColor }}
              >
                {paid ? "PAID" : overdue ? r.tone.toUpperCase() : "AUTO"}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="mt-2 rounded border border-hairline bg-paper px-3 py-2 font-mono text-[11px] text-muted">
        {day >= 3
          ? "→ All settled. Overdue re-runs the ladder on autopilot."
          : "→ Gentle nudge sending in 2 days…"}
      </div>
    </div>
  )
}