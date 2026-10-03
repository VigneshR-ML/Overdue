"use client"

import type { CalculatorField as CalculatorFieldType } from "@/lib/calculators/types"

export function CalculatorField({
  field,
  value,
  onChange,
}: {
  field: CalculatorFieldType
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block" htmlFor={field.key}>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{field.label}</span>
      <input
        id={field.key}
        type={field.type === "money" || field.type === "percent" ? "text" : field.type === "date" ? "date" : "number"}
        inputMode={field.type === "number" || field.type === "money" || field.type === "percent" ? "decimal" : undefined}
        step={field.step ?? (field.type === "number" ? "1" : undefined)}
        min={field.type === "number" ? "0" : undefined}
        value={value ?? ""}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border-b border-hairline bg-transparent py-1.5 font-mono text-[15px] text-ink outline-none transition-colors focus:border-moss focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
      />
    </label>
  )
}
