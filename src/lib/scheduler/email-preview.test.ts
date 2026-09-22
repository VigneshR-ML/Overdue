import { afterEach, describe, expect, it, vi } from "vitest"
import { signEmailPreview, verifyEmailPreview } from "./email-preview"

const SECRET = "preview-secret-for-tests"
const DRAFT = {
  userId: "user-1",
  invoiceId: "invoice-1",
  runId: "run-1",
  step: 2,
  subject: "Invoice INV-1",
  body: "Hello, this is the exact reminder body.",
  offerId: "offer-1",
} as const

afterEach(() => vi.useRealTimers())

describe("email preview confirmation token", () => {
  it("round-trips the exact reviewed content", () => {
    const token = signEmailPreview(DRAFT, SECRET)
    expect(verifyEmailPreview(token, SECRET)).toMatchObject(DRAFT)
  })

  it("rejects content or signature tampering", () => {
    const token = signEmailPreview(DRAFT, SECRET)
    const [payload, signature] = token.split(".")
    expect(verifyEmailPreview(`${payload}x.${signature}`, SECRET)).toBeNull()
    expect(verifyEmailPreview(`${payload}.${signature.slice(0, -1)}x`, SECRET)).toBeNull()
  })

  it("expires after ten minutes", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-22T12:00:00Z"))
    const token = signEmailPreview(DRAFT, SECRET)
    vi.setSystemTime(new Date("2026-09-22T12:10:01Z"))
    expect(verifyEmailPreview(token, SECRET)).toBeNull()
  })
})
