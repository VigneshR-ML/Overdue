import { cn } from "@/lib/utils/format"
import { formatMilestoneDate, type Milestone } from "@/lib/onboarding/timeline"
import { Check, Circle } from "lucide-react"

/**
 * Renders the per-invoice recovery timeline (UX-05). States are driven by
 * stored facts only — a milestone is "done" when the database says so, never
 * estimated. The current milestone carries the reason it's still pending.
 */
export function RecoveryTimeline({ milestones }: { milestones: Milestone[] }) {
  return (
    <ol className="space-y-0">
      {milestones.map((m, i) => {
        const isLast = i === milestones.length - 1
        return (
          <li key={m.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast ? (
              <span aria-hidden className="absolute left-[11px] top-6 h-full w-px bg-hairline" />
            ) : null}
            <span
              aria-hidden
              className={cn(
                "relative z-10 mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                m.state === "done"
                  ? "border-moss/40 bg-moss-soft text-moss"
                  : m.state === "current"
                    ? "border-ember/50 bg-ember/10 text-ember"
                    : "border-hairline bg-paper text-faint",
              )}
            >
              {m.state === "done" ? <Check size={13} strokeWidth={2.5} /> : <Circle size={9} strokeWidth={2} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className={cn("text-[14px] font-medium", m.state === "pending" ? "text-faint" : "text-ink")}>
                  {m.label}
                </span>
                {m.date ? (
                  <span className="font-mono text-[11px] text-faint">{formatMilestoneDate(m.date)}</span>
                ) : null}
              </div>
              {m.note ? (
                <p className={cn("mt-0.5 text-[13px] leading-relaxed", m.state === "pending" ? "text-muted" : "text-muted")}>
                  {m.note}
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}