import type { SequenceStep } from "@/types"

const VALID_TONES = new Set<SequenceStep["tone"]>(["gentle", "nudge", "firm", "final"])

/** Validate and canonicalize untrusted ladder JSON before it reaches storage. */
export function cleanSequenceSteps(input: unknown, options: { allowEmpty?: boolean } = {}): SequenceStep[] {
  if (!Array.isArray(input)) throw new Error("steps must be an array")
  if (!options.allowEmpty && input.length === 0) throw new Error("a ladder needs at least one rung")
  if (input.length > 20) throw new Error("max 20 steps per ladder")

  return input.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`step ${index + 1} must be an object`)
    }
    const step = raw as Record<string, unknown>
    const delay = Number(step.delay_days)
    if (!Number.isFinite(delay) || delay < 0 || delay > 365) {
      throw new Error(`step ${index + 1}: delay_days must be between 0 and 365`)
    }
    if (!VALID_TONES.has(step.tone as SequenceStep["tone"])) {
      throw new Error(`step ${index + 1}: invalid tone`)
    }

    const subject = String(step.subject_template ?? "").trim().slice(0, 200)
    const body = String(step.body_template ?? "").trim().slice(0, 5000)
    if (!subject || !body) throw new Error(`step ${index + 1}: subject and body are required`)

    return {
      id: typeof step.id === "string" && step.id.length <= 80 ? step.id : crypto.randomUUID(),
      step_order: index + 1,
      delay_days: Math.floor(delay),
      tone: step.tone as SequenceStep["tone"],
      subject_template: subject,
      body_template: body,
      ai_enabled: step.ai_enabled !== false,
    }
  })
}
