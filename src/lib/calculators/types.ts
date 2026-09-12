import type { ReactNode } from "react"

/**
 * Canonical calculator contracts. Lives in lib (not components) so both the
 * marketing teaser and the authenticated app UI can share specs without a
 * lib → component import cycle. Every `compute` is pure client-side
 * arithmetic — no data ever leaves the browser.
 */
export interface CalculatorField {
  key: string
  label: string
  type: "money" | "number" | "percent" | "date" | "text"
  placeholder?: string
  defaultValue: string
  step?: string
}

export interface CalculatorResult {
  label: string
  value: string
  sub?: string
  tone?: "moss" | "ember" | "rust"
}

export interface CalculatorSpec {
  title: string
  kicker: string
  description: ReactNode
  fields: CalculatorField[]
  compute: (values: Record<string, string>) => CalculatorResult[]
  example?: Record<string, string>
}
