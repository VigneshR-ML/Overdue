import * as React from "react"
import { cn } from "@/lib/utils/format"

type Variant = "ink" | "moss" | "outline" | "ghost" | "paper"
type Size = "sm" | "md" | "lg"

const variants: Record<Variant, string> = {
  ink: "bg-ink text-paper hover:bg-ink-soft focus-ring",
  moss: "bg-moss text-white hover:bg-moss-bright focus-ring",
  outline: "bg-transparent border border-hairline text-ink hover:border-ink-soft hover:bg-surface focus-ring",
  ghost: "bg-transparent text-ink-soft hover:text-ink hover:bg-hairline/60 focus-ring",
  paper: "bg-paper text-ink border border-hairline hover:bg-surface focus-ring",
}

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "ink", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-150 cursor-pointer select-none",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
)
Button.displayName = "Button"