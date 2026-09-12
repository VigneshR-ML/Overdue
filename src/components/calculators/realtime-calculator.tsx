"use client"

import { useMemo, useState } from "react"
import type { CalculatorSpec } from "@/lib/calculators/types"

function seedFrom(spec: CalculatorSpec): Record<string, string> {
  if (spec.example) return { ...spec.example }
  return Object.fromEntries(spec.fields.map((f) => [f.key, f.defaultValue]))
}

function slugify(s: string) {
  return s.replace(/[^a-z0-9]+/gi, "-").toLowerCase()
}

/**
 * Realtime calculator — separate from the old marketing leaf. There is no
 * submit button by design: results recompute live on every keystroke via
 * `useMemo`, announced through `aria-live`.
 */
export function RealtimeCalculator({
  spec,
  compact = false,
  idPrefix,
}: {
  spec: CalculatorSpec
  compact?: boolean
  idPrefix?: string
}) {
  const [values, setValues] = useState<Record<string, string>>(() => seedFrom(spec))
  const [copied, setCopied] = useState(false)

  // Live on every change — no submit step.
  const results = useMemo(() => {
    try {
      return spec.compute(values)
    } catch {
      return [{ label: "Result", value: "—", sub: "Check your inputs and try again." }]
    }
  }, [spec, values])

  const resultText = useMemo(
    () => results.map((r) => `${r.label}: ${r.value}${r.sub ? ` (${r.sub})` : ""}`).join("\n"),
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
      // clipboard is best-effort
    }
  }

  function reset() {
    setValues(seedFrom(spec))
  }

  const prefix = idPrefix ?? slugify(spec.title)

  return (
    <div className={compact ? "mx-auto max-w-md" : "mx-auto max-w-md"}>
      {!compact ? (
        <>
          <h2 className="font-display text-3xl tracking-tight text-ink">{spec.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{spec.description}</p>
        </>
      ) : null}

      <div
        className="mt-6 space-y-4 rounded-lg border border-hairline bg-surface p-5 shadow-ledger"
        role="group"
        aria-label={`${spec.title} inputs — results update live`}
      >
        {spec.fields.map((f) => {
          const id = `rtc-${prefix}-${f.key}`
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
          <p className="font-mono text-[11px] text-faint">Updates live as you type — nothing is sent anywhere.</p>
          <button
            type="button"
            onClick={reset}
            className="shrink-0 rounded-full border border-hairline px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted transition-colors hover:border-moss hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-hairline bg-surface shadow-ledger">
        <div className="flex items-center justify-between border-b border-hairline bg-paper/70 px-5 py-2.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Result · live</span>
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
              Enter values above — results appear here instantly.
            </div>
          ) : (
            results.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-4 px-5 py-3">
                <dt className="min-w-0 max-w-40 text-[13px] text-muted">{r.label}</dt>
                <dd className="text-right">
                  <div
                    className={
                      r.tone === "rust"
                        ? "text-rust"
                        : r.tone === "ember"
                          ? "text-ember"
                          : r.tone === "moss"
                            ? "text-moss"
                            : "text-ink"
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
