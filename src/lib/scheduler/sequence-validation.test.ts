import { describe, expect, it } from "vitest"
import { cleanSequenceSteps } from "./sequence-validation"

const valid = {
  id: "rung-1",
  step_order: 99,
  delay_days: 2.9,
  tone: "gentle",
  subject_template: " Reminder ",
  body_template: " Hello ",
  ai_enabled: true,
}

describe("cleanSequenceSteps", () => {
  it("canonicalizes order, delays and text", () => {
    expect(cleanSequenceSteps([valid])).toEqual([
      { ...valid, step_order: 1, delay_days: 2, subject_template: "Reminder", body_template: "Hello" },
    ])
  })

  it("rejects missing, malformed and oversized ladders", () => {
    expect(() => cleanSequenceSteps([])).toThrow("at least one rung")
    expect(() => cleanSequenceSteps("nope")).toThrow("array")
    expect(() => cleanSequenceSteps(Array.from({ length: 21 }, () => valid))).toThrow("max 20")
  })

  it("rejects invalid delays, tones and empty copy", () => {
    expect(() => cleanSequenceSteps([{ ...valid, delay_days: -1 }])).toThrow("delay_days")
    expect(() => cleanSequenceSteps([{ ...valid, tone: "hostile" }])).toThrow("invalid tone")
    expect(() => cleanSequenceSteps([{ ...valid, body_template: "" }])).toThrow("subject and body")
  })
})
