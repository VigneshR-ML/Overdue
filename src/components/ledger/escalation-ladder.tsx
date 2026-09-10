"use client"

import { cn } from "@/lib/utils/format"
import { TONE_META, type SequenceStep, type Tone } from "@/types"

const TONE_ORDER: Tone[] = ["gentle", "nudge", "firm", "final"]

/**
 * The Escalation Ladder — Overdue's signature visual. A vertical cascade of
 * steps whose color temperature warms as the tone goes from gentle to final.
 */
export function EscalationLadder({
  steps,
  minified = false,
  onStepClick,
}: {
  steps: SequenceStep[]
  minified?: boolean
  onStepClick?: (step: SequenceStep) => void
}) {
  const rows = steps.length
    ? [...steps].sort((a, b) => a.step_order - b.step_order)
    : TONE_ORDER.map((tone, i) => ({
        id: tone,
        step_order: i + 1,
        delay_days: [1, 7, 7, 7][i] ?? 7,
        tone,
        ai_enabled: true,
        subject_template: "",
        body_template: "",
      }))

  return (
    <ol className="relative space-y-3">
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
        return (
          <li key={step.id} className="relative pl-8">
            <span
              className="absolute left-0 top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border bg-surface"
              style={{ borderColor: meta.border }}
            >
              <span className="flex flex-col items-center" style={{ color: meta.color }}>
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
              onClick={() => onStepClick?.(step)}
              className={cn(
                "w-full rounded-md border bg-surface text-left transition-all duration-150",
                onStepClick && "cursor-pointer hover:-translate-y-px hover:shadow-ledger",
              )}
              style={{ borderColor: meta.border, borderTop: `3px solid ${meta.border}` }}
            >
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div className="flex min-w-0 flex-col items-start gap-0.5">
                  <span className="font-display text-[15px] leading-tight" style={{ color: warm ? meta.color : "#1D1B17" }}>
                    Step {step.step_order} — {meta.label}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted" style={{ color: meta.color }}>
                    day {step.delay_days} {step.step_order === 1 ? "past due" : "after prior touch"}
                  </span>
                </div>
                {minified ? null : (
                  <span className="hidden truncate text-[13px] text-muted sm:block">
                    {step.subject_template ? truncate(step.subject_template, 42) : "No subject set"}
                  </span>
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