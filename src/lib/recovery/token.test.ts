import { describe, expect, it } from "vitest"
import { signResolutionToken, verifyResolutionToken } from "./token"

describe("resolution token", () => {
  it("round-trips a valid token", () => {
    process.env.SETTLEMENT_SECRET = "test-secret"
    const t = signResolutionToken("offer-1", Date.now() + 3600000)
    const v = verifyResolutionToken(t)
    expect(v?.offerId).toBe("offer-1")
  })

  it("rejects tampered tokens", () => {
    process.env.SETTLEMENT_SECRET = "test-secret"
    const t = signResolutionToken("offer-1", Date.now() + 3600000)
    expect(verifyResolutionToken(t.replace("offer-1", "offer-2"))).toBeNull()
    expect(verifyResolutionToken("garbage")).toBeNull()
  })
})
