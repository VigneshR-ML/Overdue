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
  const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`
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
  function recordingDb(opts?: {
    invoice?: { id: string; amount_cents: number } | null
    flipRows?: Array<{ id: string }>
    updateError?: { message: string }
    offers?: Array<{ id: string }>
  }) {
    const invoice = opts && "invoice" in opts ? opts.invoice : { id: "inv_1", amount_cents: 1000 }
    const ops: Array<{ table: string; op: string; args: any[] }> = []

    const from = (table: string) => {
      let updated = false
      let inserted = false
      const q = new Proxy(
        {},
        {
          get(_t, prop: string) {
            if (prop === "then") return undefined
            return (...args: any[]) => {
              ops.push({ table, op: prop, args })
              if (prop === "update") {
                updated = true
                return q
              }
              if (prop === "single" && table === "payments" && inserted) {
                return { data: { id: "payment_1" }, error: null }
              }
              if (prop === "maybeSingle") {
                return table === "invoices" ? { data: invoice, error: null } : { data: null, error: null }
              }
              if (prop === "insert") {
                inserted = true
                return q
              }
              if (prop === "select") {
                if (updated) {
                  if (opts?.updateError) return { data: [], error: opts.updateError }
                  return { data: opts?.flipRows ?? [{ id: "flipped" }], error: null }
                }
                return q
              }
              if (table === "settlement_offers" && prop === "in" && !updated) {
                return { data: opts?.offers ?? [{ id: "o1" }], error: null }
              }
              return q
            }
          },
        },
      )
      return q
    }

    const appliedCents = opts?.flipRows?.length === 0 ? 0 : Number(invoice?.amount_cents ?? 1000)
    const rpc = (name: string) => {
      ops.push({ table: "rpc", op: name, args: [] })
      if (name !== "reconcile_confirmed_payment") return Promise.resolve({ data: null, error: null })
      return Promise.resolve({
        data: {
          invoice_id: invoice?.id ?? "inv_1",
          user_id: "u1",
          workspace_id: null,
          applied_cents: appliedCents,
          fully_paid: appliedCents > 0,
          plan_completed: false,
        },
        error: opts?.updateError ?? null,
      })
    }
    return { db: { from, rpc }, ops }
  }

  it("flips to paid with full amount by default", async () => {
    const { db, ops } = recordingDb()
    const res = await markInvoicePaid(db, "stripe", "in_1", "u1")
    expect(res).toEqual({ flipped: 1, error: null })
    const paymentInsert = ops.find((o) => o.table === "payments" && o.op === "insert")
    expect(paymentInsert?.args[0]).toMatchObject({ amount_cents: 1000, source: "stripe", status: "confirmed" })
    expect(ops.some((o) => o.table === "rpc" && o.op === "reconcile_confirmed_payment")).toBe(true)
  })

  it("writes the provider-sent amount and clamps to the balance", async () => {
    const { db, ops } = recordingDb({ invoice: { id: "inv_1", amount_cents: 5000 } })
    await markInvoicePaid(db, "paypal", "INV-2", "u1", { paidCents: 499994 }) // "$4999.94"
    const paymentInsert = ops.find((o) => o.table === "payments" && o.op === "insert")
    expect(paymentInsert?.args[0].amount_cents).toBe(5000)
    await markInvoicePaid(db, "stripe", "in_3", "u1", { paidCents: 1200 })
    const payments = ops.filter((o) => o.table === "payments" && o.op === "insert")
    expect(payments[1].args[0].amount_cents).toBe(1200)
  })

  it("reconciles runs, disputes and offers only when the flip actually happened", async () => {
    const { db, ops } = recordingDb({ flipRows: [{ id: "flipped" }], offers: [{ id: "o1" }] })
    await markInvoicePaid(db, "stripe", "in_1", "u1")
    expect(ops.some((o) => o.table === "runs" && o.op === "update")).toBe(true)
    expect(ops.some((o) => o.table === "disputes" && o.op === "update")).toBe(true)
    const offerUpdate = ops.find((o) => o.table === "settlement_offers" && o.op === "update")
    expect(offerUpdate?.args[0]).toMatchObject({ status: "paid" })
    const evtInsert = ops.find((o) => o.table === "settlement_events" && o.op === "insert")
    expect(evtInsert?.args[0]).toEqual([
      { offer_id: "o1", user_id: "u1", event: "paid", meta: { source: "confirmed_payment" } },
    ])
  })

  it("skips reconciliation when the invoice was already paid", async () => {
    const { db, ops } = recordingDb({ flipRows: [] })
    const res = await markInvoicePaid(db, "stripe", "in_1", "u1")
    expect(res).toEqual({ flipped: 0, error: null })
    expect(ops.some((o) => o.table === "settlement_events" && o.op === "insert")).toBe(false)
  })

  it("surfaces write errors so webhooks can refuse to acknowledge", async () => {
    const { db } = recordingDb({ updateError: { message: "connection reset" } })
    const res = await markInvoicePaid(db, "stripe", "in_1", "u1")
    expect(res).toEqual({ flipped: 0, error: "connection reset" })
  })

  it("refuses unscoped flips (no userId) to prevent cross-tenant writes", async () => {
    const { db } = recordingDb()
    await expect(markInvoicePaid(db, "stripe", "in_1")).resolves.toEqual({ flipped: 0, error: null })
  })

  it("no-ops on empty provider id or unknown invoice", async () => {
    const { db } = recordingDb({ invoice: null })
    await expect(markInvoicePaid(db, "xero", "", "u1")).resolves.toEqual({ flipped: 0, error: null })
    await expect(markInvoicePaid(db, "stripe", "missing", "u1")).resolves.toEqual({ flipped: 0, error: null })
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
