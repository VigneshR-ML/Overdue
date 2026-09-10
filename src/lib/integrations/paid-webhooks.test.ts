import crypto from "node:crypto"
import { describe, expect, it, vi, afterEach } from "vitest"
import {
  verifyStripeSignature,
  verifyXeroSignature,
  verifyPaypalWebhook,
  markInvoicePaid,
  resolveXeroUser,
} from "./paid-webhooks"

function chainFake(handlers: Record<string, (...a: any[]) => any>) {
  const chain: any = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "then") return undefined
        return (...args: any[]) => {
          if (handlers[prop]) return handlers[prop](...args)
          return chain
        }
      },
    },
  )
  return chain
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("verifyStripeSignature", () => {
  const secret = "whsec_test_stripe"
  const raw = JSON.stringify({ id: "evt_1", type: "invoice.paid" })
  const sign = (ts: string) =>
    `t=${ts},v1=${crypto.createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex")}`

  it("accepts a fresh valid signature", () => {
    const ts = String(Math.floor(Date.now() / 1000))
    expect(verifyStripeSignature(sign(ts), raw, secret)).toBe(true)
  })

  it("rejects replays older than tolerance", () => {
    const ts = String(Math.floor(Date.now() / 1000) - 3600)
    expect(verifyStripeSignature(sign(ts), raw, secret)).toBe(false)
  })

  it("rejects wrong secret and missing header", () => {
    const ts = String(Math.floor(Date.now() / 1000))
    expect(verifyStripeSignature(sign(ts), raw, "nope")).toBe(false)
    expect(verifyStripeSignature("", raw, secret)).toBe(false)
  })
})

describe("verifyXeroSignature", () => {
  const key = "xero-signing-key"
  const raw = JSON.stringify({ events: [] })

  it("accepts base64 (Xero format)", () => {
    const sig = crypto.createHmac("sha256", key).update(raw).digest("base64")
    expect(verifyXeroSignature(sig, raw, key)).toBe(true)
  })

  it("accepts hex too", () => {
    const sig = crypto.createHmac("sha256", key).update(raw).digest("hex")
    expect(verifyXeroSignature(sig, raw, key)).toBe(true)
  })

  it("rejects bad signature and missing key", () => {
    expect(verifyXeroSignature("deadbeef", raw, key)).toBe(false)
    expect(verifyXeroSignature("deadbeef", raw, "")).toBe(false)
  })
})

describe("verifyPaypalWebhook", () => {
  const base = {
    transmissionId: "t1",
    transmissionTime: "2026-01-01T00:00:00Z",
    certUrl: "https://api.sandbox.paypal.com/certs",
    authAlgo: "SHA256withRSA",
    transmissionSig: "sig",
    webhookEvent: { id: "WH-1", event_type: "INVOICING.INVOICE.PAID" },
    clientId: "cid",
    clientSecret: "csec",
    webhookId: "WH-ID",
    mode: "sandbox",
  }

  it("returns true on SUCCESS", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ verification_status: "SUCCESS" }) })))
    await expect(verifyPaypalWebhook(base)).resolves.toBe(true)
  })

  it("returns false on FAILURE and when unconfigured", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ verification_status: "FAILURE" }) })))
    await expect(verifyPaypalWebhook(base)).resolves.toBe(false)
    await expect(verifyPaypalWebhook({ ...base, webhookId: "" })).resolves.toBe(false)
  })
})

describe("markInvoicePaid", () => {
  function fakeDb(rows: any[]) {
    const chain = chainFake({
      update: () => chain,
      eq: () => chain,
      neq: () => chain,
      select: () => ({ data: rows, error: null }),
    })
    return { from: () => chain }
  }

  it("returns flipped count", async () => {
    await expect(markInvoicePaid(fakeDb([{ id: "a" }]), "stripe", "in_1")).resolves.toBe(1)
    await expect(markInvoicePaid(fakeDb([]), "paypal", "INV-9")).resolves.toBe(0)
  })

  it("no-ops on empty provider id", async () => {
    await expect(markInvoicePaid(fakeDb([{ id: "a" }]), "xero", "")).resolves.toBe(0)
  })
})

describe("resolveXeroUser", () => {
  it("maps tenant to user", async () => {
    const chain = chainFake({
      select: () => chain,
      eq: () => chain,
      maybeSingle: () => ({ data: { user_id: "u9" }, error: null }),
    })
    await expect(resolveXeroUser({ from: () => chain }, "tenant-1")).resolves.toBe("u9")
  })

  it("returns null when unknown", async () => {
    const chain = chainFake({
      select: () => chain,
      eq: () => chain,
      maybeSingle: () => ({ data: null, error: null }),
    })
    await expect(resolveXeroUser({ from: () => chain }, "nope")).resolves.toBeNull()
  })
})
