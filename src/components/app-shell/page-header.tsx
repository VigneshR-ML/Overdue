import * as React from "react"
import { cn } from "@/lib/utils/format"

/**
 * Page header with a folio spine — kicker, display title, description, and an
 * action aligned to the baseline, closed by a hairline rule. Every workspace
 * page shares it, so the squint test reads the same everywhere: primary title,
 * secondary action, major groups below in one cadence.
 */
export function PageHeader({
  kicker,
  title,
  description,
  action,
  className,
}: {
  kicker?: string
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn("border-b border-hairline pb-6", className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          {kicker ? (
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">{kicker}</div>
          ) : null}
          <h1 className="mt-1.5 font-display text-3xl tracking-tight text-ink sm:text-4xl">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-measure text-sm leading-relaxed text-muted">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  )
}