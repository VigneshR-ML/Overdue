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

function seedFrom(spec: CalculatorSpec): Record<string, string> {
  if (spec.example) return { ...spec.example }
  return Object.fromEntries(spec.fields.map((f: CalculatorField) => [f.key, f.defaultValue]))
}

export function Calculator({ spec }: { spec: CalculatorSpec }) {
  const [values, setValues] = useState<Record<string, string>>(() => seedFrom(spec))
  const [copied, setCopied] = useState(false)
  const results = useMemo(() => {
    try {
      return spec.compute(values)
    } catch {
      return [{ label: "Result", value: "—", sub: "Check your inputs and try again." }]
    }
  }, [spec, values])

  const resultText = useMemo(
    () =>
      results
        .map((r) => `${r.label}: ${r.value}${r.sub ? ` (${r.sub})` : ""}`)
        .join("\n"),
    [results],
  )

  async function copyResults() {
    try {
      const text = `${spec.title}\n${resultText}`
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement("textarea")
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        document.execCommand("copy")
        ta.remove()
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // clipboard failure stays silent — copy affordance is best-effort
    }
  }

  function reset() {
    setValues(seedFrom(spec))
  }

  return (
    <div className="mx-auto max-w-md">
      <h2 className="font-display text-3xl tracking-tight text-ink">{spec.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{spec.description}</p>

      <form
        className="mt-6 space-y-4 rounded-lg border border-hairline bg-surface p-5 shadow-ledger"
        onSubmit={(e) => e.preventDefault()}
        aria-label={`${spec.title} inputs`}
      >
        {spec.fields.map((f) => {
          const id = `calc-${spec.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${f.key}`
          return (
            <label key={f.key} className="block" htmlFor={id}>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{f.label}</span>
              <input
                id={id}
                type={f.type === "money" || f.type === "percent" ? "text" : f.type === "date" ? "date" : "number"}
                inputMode={f.type === "number" || f.type === "money" || f.type === "percent" ? "decimal" : undefined}
                step={f.step ?? (f.type === "number" ? "1" : undefined)}
                min={f.type === "number" ? "0" : undefined}
                value={values[f.key] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className="mt-1.5 w-full border-b border-hairline bg-transparent py-1.5 font-mono text-[15px] text-ink outline-none transition-colors focus:border-moss focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss dark:focus:border-moss-bright"
              />
            </label>
          )
        })}
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="font-mono text-[11px] text-faint">Runs in your browser — nothing is sent anywhere.</p>
          <button
            type="button"
            onClick={reset}
            className="shrink-0 rounded-full border border-hairline px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted transition-colors hover:border-moss hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
          >
            Reset
          </button>
        </div>
      </form>

      <div className="mt-5 overflow-hidden rounded-lg border border-hairline bg-surface shadow-ledger">
        <div className="flex items-center justify-between border-b border-hairline bg-paper/70 px-5 py-2.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Result</span>
          <button
            type="button"
            onClick={copyResults}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-moss transition-colors hover:text-moss-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
          >
            {copied ? "copied ✓" : "copy"}
          </button>
        </div>
        <dl className="divide-y divide-hairline" aria-live="polite" aria-atomic="true">
          {results.length === 0 ? (
            <div className="px-5 py-4 text-[13px] text-muted">
              Enter values above — nothing leaves your browser.
            </div>
          ) : (
            results.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-4 px-5 py-3">
                <dt className="min-w-0 max-w-40 text-[13px] text-muted">{r.label}</dt>
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
            ))
          )}
        </dl>
      </div>
    </div>
  )
}
