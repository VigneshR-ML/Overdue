import { describe, expect, it } from "vitest"
import { validatePassword } from "./password"

describe("validatePassword", () => {
  it("accepts a password that meets every requirement", () => {
    expect(validatePassword("Overdue123")).toBeNull()
  })

  it("requires at least ten characters", () => {
    expect(validatePassword("Short1A")).toBe("Password must be at least 10 characters.")
  })

  it("requires an uppercase letter", () => {
    expect(validatePassword("overdue1234")).toBe("Password must include an uppercase letter.")
  })

  it("requires a number", () => {
    expect(validatePassword("OverduePass")).toBe("Password must include a number.")
  })
})
