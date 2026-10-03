"use client"

import { useMemo, useState } from "react"
import { ToolCalculatorDoc } from "@/lib/seo/tool-calculators"
import { CalculatorField } from "@/components/calculators/calculator-field"
import { CalculatorResultBlock } from "@/components/calculators/calculator-result"

export function PublicToolDetail({ tool }: { tool: ToolCalculatorDoc }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const f of tool.spec.fields) init[f.key] = f.defaultValue ?? ""
    return init
  })

  const results = useMemo(() => tool.spec.compute(values), [tool.spec, values])

  return (
    <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6">
        <div className="rounded-lg border border-hairline bg-surface p-6 shadow-ledger">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">{tool.spec.kicker}</div>
              <h2 className="mt-2 font-display text-2xl text-ink">{tool.spec.title}</h2>
            </div>
          </div>
          <p className="mb-6 text-[14px] leading-relaxed text-muted">{tool.spec.description}</p>
          <div className="space-y-5">
            {tool.spec.fields.map((f) => (
              <CalculatorField
                key={f.key}
                field={f}
                value={values[f.key] ?? ""}
                onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="md:sticky md:top-28">
        <CalculatorResultBlock results={results} />
        <div className="mt-4 rounded-lg border border-hairline bg-surface p-4 text-[12px] text-muted">
          This free calculator runs entirely in your browser. No data is sent to our servers.
        </div>
      </div>
    </div>
  )
}
