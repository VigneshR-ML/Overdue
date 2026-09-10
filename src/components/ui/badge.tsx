import * as React from "react"
import { cn } from "@/lib/utils/format"

export function Badge({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export function StatusDot({ color }: { color: string }) {
  return <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />
}

export function PaidBadge() {
  return (
    <Badge className="border-moss/30 bg-moss-soft text-moss">
      <StatusDot color="#2F5D50" /> Paid
    </Badge>
  )
}

export function OverdueBadge({ days }: { days: number }) {
  const color = days <= 7 ? "#C29A43" : days <= 14 ? "#D9792B" : days <= 21 ? "#C14E2B" : "#9E2A23"
  return (
    <Badge className="border-hairline" style={{ color }}>
      <StatusDot color={color} /> {days}d overdue
    </Badge>
  )
}

export function SentBadge() {
  return (
    <Badge className="border-hairline text-muted">
      <StatusDot color="#A7A091" /> Sent
    </Badge>
  )
}