import crypto from "crypto"
import { describe, expect, it, vi } from "vitest"
import { signState, verifyState } from "./oauth"

describe("OAuth state", () => {
  it("round-trips a fresh signed state", () => {
    process.env.CRON_SECRET = "test-secret"
    const state = signState("user-1")
    expect(verifyState(state)).toBe("user-1")
  })

  it("rejects expired and future-dated states", () => {
    process.env.CRON_SECRET = "test-secret"
    const now = Date.now()
    const make = (timestamp: number) => {
      const payload = Buffer.from(`user-1:${timestamp}`).toString("base64url")
      const sig = crypto.createHmac("sha256", "test-secret").update(payload).digest("base64url").slice(0, 32)
      return `${payload}.${sig}`
    }
    expect(verifyState(make(now - 11 * 60_000))).toBeNull()
    expect(verifyState(make(now + 60_000))).toBeNull()
  })

  it("rejects tampering", () => {
    process.env.CRON_SECRET = "test-secret"
    vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000)
    const state = signState("user-1")
    const tampered = `${state.slice(0, -1)}${state.endsWith("A") ? "B" : "A"}`
    expect(verifyState(tampered)).toBeNull()
    vi.restoreAllMocks()
  })
})
