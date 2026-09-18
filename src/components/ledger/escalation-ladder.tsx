"use client"

import { cn } from "@/lib/utils/format"
import { TONE_META, type SequenceStep, type Tone } from "@/types"
import { Pencil } from "lucide-react"

const TONE_ORDER: Tone[] = ["gentle", "nudge", "firm", "final"]

/**
 * The Escalation Ladder — Overdue's signature visual. A vertical cascade of
 * steps whose color temperature warms as the tone goes from gentle to final.
 * The rung being edited is marked with a filled temperature dot and a pencil.
 */
export function EscalationLadder({
  steps,
  minified = false,
  onStepClick,
  selectedId,
}: {
  steps: SequenceStep[]
  minified?: boolean
  onStepClick?: (step: SequenceStep) => void
  selectedId?: string
}) {
  const rows = steps.length
    ? [...steps].sort((a, b) => a.step_order - b.step_order)
    : TONE_ORDER.map((tone, i) => ({
        id: tone,
        step_order: i + 1,
        delay_days: [1, 6, 7, 7][i] ?? 7,
        tone,
        ai_enabled: true,
        subject_template: "",
        body_template: "",
      }))

  return (
    <ol className="relative space-y-2.5">
      {/* temperature gradient rail */}
      <div
        className="absolute left-[9px] top-3 bottom-3 w-[2px] rounded-full"
        style={{
          background:
            "linear-gradient(180deg, #C29A43 0%, #D9792B 35%, #C14E2B 70%, #9E2A23 100%)",
        }}
        aria-hidden
      />
      {rows.map((step) => {
        const meta = TONE_META[step.tone] ?? { label: step.tone, color: "#A7A091", border: "#A7A091" }
        const warm = step.tone === "firm" || step.tone === "final"
        const selected = selectedId === step.id
        return (
          <li key={step.id} className="relative pl-8">
            <span
              className="absolute left-0 top-2 flex h-[18px] w-[18px] items-center justify-center rounded-full border bg-surface transition-colors duration-150"
              style={{ borderColor: meta.border, background: selected ? meta.color : "var(--surface)" }}
            >
              <span className="flex flex-col items-center transition-colors duration-150" style={{ color: selected ? "#FFFFFF" : meta.color }}>
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                  <path
                    d="M5 9V1M5 1 1.5 4.5M5 1l3.5 3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </span>
            <button
              type="button"
              disabled={!onStepClick}
              aria-pressed={onStepClick ? selected : undefined}
              onClick={() => onStepClick?.(step)}
              className={cn(
                "w-full rounded-lg border bg-surface text-left transition-all duration-150",
                onStepClick && "cursor-pointer hover:-translate-y-px hover:shadow-ledger",
                selected && "shadow-ledger",
              )}
              style={{ borderColor: meta.border, borderTop: `3px solid ${meta.border}` }}
            >
              <div className="flex items-center gap-3 px-3.5 py-3">
                <div className="flex min-w-0 flex-col items-start gap-0.5">
                  <span className="font-display text-[15px] leading-tight" style={{ color: warm ? meta.color : "#1D1B17" }}>
                    Step {step.step_order} — {meta.label}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: meta.color }}>
                    day {step.delay_days} {step.step_order === 1 ? "past due" : "after prior touch"}
                  </span>
                </div>
                {minified ? null : (
                  <>
                    <span className="ml-auto hidden max-w-[9rem] truncate text-[12px] text-muted sm:block">
                      {step.subject_template ? truncate(step.subject_template, 30) : "No subject set"}
                    </span>
                    {selected ? (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-moss/10 text-moss">
                        <Pencil className="h-3 w-3" />
                      </span>
                    ) : null}
                  </>
                )}
              </div>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

export function TonePill({ tone }: { tone: Tone }) {
  const meta = TONE_META[tone] ?? { label: tone, color: "#A7A091", border: "#A7A091" }
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]"
      style={{ borderColor: meta.border, color: meta.color, background: "rgba(255,255,255,0.7)" }}
    >
      {meta.label}
    </span>
  )
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s
}