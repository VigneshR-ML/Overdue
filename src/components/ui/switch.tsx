"use client"

import * as React from "react"
import { cn } from "@/lib/utils/format"

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-150 focus-ring cursor-pointer",
        "disabled:cursor-not-allowed disabled:opacity-55",
        checked ? "bg-moss border-moss" : "bg-hairline border-hairline",
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-150",
          checked ? "translate-x-[18px]" : "translate-x-[2px]",
        )}
      />
    </button>
  )
}

export function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  title: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className={cn(disabled && "opacity-60")}>
        <div className="text-sm font-medium text-ink">{title}</div>
        {description ? <div className="text-[13px] text-muted mt-0.5">{description}</div> : null}
      </div>
      <Switch checked={checked} onChange={onChange} label={title} disabled={disabled} />
    </div>
  )
}