"use client"

import { useMemo, useState } from "react"
import { formatMoney } from "@/lib/utils/format"
import type { ReactNode } from "react"

export interface CalculatorField {
  key: string
  label: string
  type: "money" | "number" | "percent" | "date" | "text"
  placeholder?: string
  defaultValue: string
  step?: string
}

export interface CalculatorResult {
  label: string
  value: string
  sub?: string
  tone?: "moss" | "ember" | "rust"
}

export interface CalculatorSpec {
  title: string
  kicker: string
  description: ReactNode
  fields: CalculatorField[]
  compute: (values: Record<string, string>) => CalculatorResult[]
  example?: Record<string, string>
}

function toCents(v: string): number {
  const n = parseFloat(String(v).replace(/[$,\s]/g, ""))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

function fmt(cents: number) {
  return formatMoney(Math.round(cents))
}

function fmtPct(v: string): number {
  const n = parseFloat(String(v).replace(/[%\s]/g, ""))
  return Number.isFinite(n) ? n : 0
}

/** A single public calculator — pure client-side arithmetic, no data leaves the browser. */
function seedFrom(spec: CalculatorSpec): Record<string, string> {
  if (spec.example) return { ...spec.example }
  return Object.fromEntries(spec.fields.map((f: CalculatorField) => [f.key, f.defaultValue]))
}

export function Calculator({ spec }: { spec: CalculatorSpec }) {
  const [values, setValues] = useState<Record<string, string>>(() => seedFrom(spec))
  const [results, setResults] = useState<CalculatorResult[]>([])
  const results2 = useMemo(() => spec.compute(values), [spec, values])

  return (
    <div className="mx-auto max-w-md">
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">{spec.kicker}</div>
      <h1 className="mt-1 font-display text-3xl tracking-tight text-ink">{spec.title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{spec.description}</p>

      <form
        className="mt-6 space-y-4 rounded-lg border border-hairline bg-surface p-5 shadow-ledger"
        onSubmit={(e) => e.preventDefault()}
      >
        {spec.fields.map((f) => (
          <label key={f.key} className="block">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{f.label}</span>
            <input
              type={f.type === "money" || f.type === "percent" ? "text" : f.type === "date" ? "date" : "number"}
              inputMode={f.type === "number" || f.type === "money" ? "decimal" : undefined}
              step={f.step}
              value={values[f.key] ?? ""}
              placeholder={f.placeholder}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="mt-1.5 w-full border-b border-hairline bg-transparent py-1.5 font-mono text-[15px] text-ink outline-none transition-colors focus:border-moss dark:focus:border-moss-bright"
            />
          </label>
        ))}
      </form>

      <div className="mt-5 overflow-hidden rounded-lg border border-hairline bg-surface shadow-ledger">
        <div className="border-b border-hairline bg-paper/70 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          Result
        </div>
        <dl className="divide-y divide-hairline">
          {results.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-4 px-5 py-3">
              <dt className="max-w-40 min-w-0 text-[13px] text-muted">{r.label}</dt>
              <dd className="text-right">
                <div
                  className={
                    r.tone === "rust" ? "text-rust" : r.tone === "ember" ? "text-ember" : r.tone === "moss" ? "text-moss" : "text-ink"
                  }
                >
                  <span className="font-display text-xl tracking-tight">{r.value}</span>
                </div>
                {r.sub ? <div className="text-[11px] text-faint">{r.sub}</div> : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
