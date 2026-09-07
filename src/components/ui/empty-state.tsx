import * as React from "react"
import { cn } from "@/lib/utils/format"

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed border-hairline bg-surface/50 px-6 py-14 text-center", className)}>
      {icon ? <div className="mb-4 text-faint">{icon}</div> : null}
      <h3 className="font-display text-lg text-ink">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}