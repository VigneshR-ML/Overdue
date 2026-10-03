"use client"

import type { CalculatorResult } from "@/lib/calculators/types"
import { cn } from "@/lib/utils/format"

function toneClass(tone?: CalculatorResult["tone"]): string {
  return tone === "rust" ? "text-rust" : tone === "ember" ? "text-ember" : tone === "moss" ? "text-moss" : "text-ink"
}

export function CalculatorResultBlock({ results }: { results: CalculatorResult[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-ledger">
      <div className="flex items-center justify-between border-b border-hairline bg-paper/70 px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Result · live</span>
      </div>
      <dl className="divide-y divide-hairline" aria-live="polite" aria-atomic="true">
        {results.length === 0 ? (
          <div className="flex min-h-16 items-center px-5 py-3 text-[13px] text-muted">
            Enter values above — results appear here instantly.
          </div>
        ) : (
          results.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-4 px-4 py-3">
              <dt className="min-w-0 text-[12px] text-muted">{r.label}</dt>
              <dd className="text-right">
                <div className={toneClass(r.tone)}>
                  <span className="font-display text-xl tracking-tight">{r.value}</span>
                </div>
                {r.sub ? <div className="text-[10px] text-faint">{r.sub}</div> : null}
              </dd>
            </div>
          ))
        )}
      </dl>
    </div>
  )
}
