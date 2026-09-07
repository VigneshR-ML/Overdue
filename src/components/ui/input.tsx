import * as React from "react"
import { cn } from "@/lib/utils/format"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-md border border-hairline bg-surface px-3 text-sm text-ink placeholder:text-faint",
        "focus:border-ink-soft focus:outline-none focus:ring-2 focus:ring-ink/10",
        "transition-colors duration-150",
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = "Input"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint",
        "focus:border-ink-soft focus:outline-none focus:ring-2 focus:ring-ink/10",
        "transition-colors duration-150 min-h-[120px]",
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = "Textarea"

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-ink-soft">{label}</span>
        {hint ? <span className="text-xs text-faint">{hint}</span> : null}
      </span>
      {children}
    </label>
  )
}