import { describe, expect, it, beforeEach } from "vitest"
import crypto from "node:crypto"
import {
  verifyPaddleSignature,
  verifyResendSignature,
  verifyInboundReplySignature,
  isBillingConfigured,
} from "@/lib/paddle/helpers"

describe("verifyPaddleSignature", () => {
  beforeEach(() => {
    process.env.PADDLE_WEBHOOK_SECRET = "paddle-secret"
  })

  it("accepts a valid HMAC-SHA256 signature", () => {
    const raw = '{"event_id":"evt_1"}'
    const secret = process.env.PADDLE_WEBHOOK_SECRET!
    const ts = String(Math.floor(Date.now() / 1000))
    const h1 = crypto.createHmac("sha256", secret).update(`${ts}:${raw}`).digest("hex")
    expect(verifyPaddleSignature(`ts=${ts};h1=${h1}`, raw)).toBe(true)
  })

  it("rejects a tampered body", () => {
    const raw = '{"event_id":"evt_1"}'
    const secret = process.env.PADDLE_WEBHOOK_SECRET!
    const ts = String(Math.floor(Date.now() / 1000))
    const h1 = crypto.createHmac("sha256", secret).update(`${ts}:${raw}`).digest("hex")
    expect(verifyPaddleSignature(`ts=${ts};h1=${h1}`, '{"event_id":"evt_2"}')).toBe(false)
  })

  it("rejects missing or malformed headers", () => {
    expect(verifyPaddleSignature("", "{}")).toBe(false)
    expect(verifyPaddleSignature("garbage", "{}")).toBe(false)
  })

  it("rejects when no secret is configured", () => {
    delete process.env.PADDLE_WEBHOOK_SECRET
    expect(verifyPaddleSignature("ts=1;h1=abc", "{}")).toBe(false)
  })
})

describe("verifyResendSignature", () => {
  beforeEach(() => {
    process.env.RESEND_WEBHOOK_SECRET = "resend-secret"
  })

  it("accepts a valid Resend v1 signature", () => {
    const raw = '{"type":"email.opened"}'
    const secret = process.env.RESEND_WEBHOOK_SECRET!
    const ts = String(Math.floor(Date.now() / 1000))
    const sig = crypto.createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex")
    expect(verifyResendSignature(`t=${ts},v1=${sig}`, raw)).toBe(true)
  })

  it("rejects a mismatched signature", () => {
    const raw = '{"type":"email.bounced"}'
    expect(verifyResendSignature("t=1720000000,v1=deadbeef", raw)).toBe(false)
  })

  it("rejects missing header", () => {
    expect(verifyResendSignature("", "{}")).toBe(false)
  })
})

describe("verifyInboundReplySignature", () => {
  beforeEach(() => {
    process.env.INBOUND_WEBHOOK_SECRET = "inbound-secret"
  })

  it("accepts a plain bearer secret", () => {
    expect(verifyInboundReplySignature({ signature: "", bearer: "inbound-secret", rawBody: "{}" })).toBe(true)
  })

  it("rejects a wrong bearer", () => {
    expect(verifyInboundReplySignature({ signature: "", bearer: "wrong", rawBody: "{}" })).toBe(false)
  })

  it("accepts a valid Svix-style signature", () => {
    const raw = "{}"
    const secret = process.env.INBOUND_WEBHOOK_SECRET!
    const ts = String(Math.floor(Date.now() / 1000))
    const sig = crypto.createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex")
    expect(verifyInboundReplySignature({ signature: `t=${ts},v1=${sig}`, bearer: "", rawBody: raw })).toBe(true)
  })

  it("rejects an invalid Svix-style signature", () => {
    expect(verifyInboundReplySignature({ signature: "t=1720000000,v1=abcd", bearer: "", rawBody: "{}" })).toBe(false)
  })

  it("rejects when nothing matches", () => {
    expect(verifyInboundReplySignature({ signature: "", bearer: "", rawBody: "{}" })).toBe(false)
  })
})

describe("isBillingConfigured", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID = "vendor-1"
    process.env.PADDLE_API_KEY = "key-1"
  })

  it("is true when both vendor and api key are set", () => {
    expect(isBillingConfigured()).toBe(true)
  })

  it("is false when either is missing", () => {
    delete process.env.PADDLE_API_KEY
    expect(isBillingConfigured()).toBe(false)
  })
})