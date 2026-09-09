import { afterEach, describe, expect, it } from "vitest"
import { renderTemplate, draftLocally, draftEmail } from "@/lib/ai/draft"
import type { Invoice, Client } from "@/types"

const invoice: Invoice = {
  id: "inv-1",
  user_id: "u1",
  client_id: "c1",
  provider: "manual",
  provider_id: "manual-1",
  number: "INV-001",
  status: "sent",
  amount_cents: 12345,
  paid_cents: 0,
  currency: "USD",
  issue_date: "2026-08-01",
  due_date: "2026-09-01",
  paid_at: null,
  line_item_summary: null,
  created_at: "2026-08-01",
}

const client: Client = {
  id: "c1",
  user_id: "u1",
  name: "Acme Co",
  email: "billing@acme.test",
  billing_email: "billing@acme.test",
  payment_history_score: null,
  avg_payment_days: null,
  created_at: "2026-01-01",
}

const baseInput = {
  tone: "nudge" as const,
  subjectTemplate: "Reminder: invoice {invoice_number}",
  bodyTemplate: "Hi {client_name}, following up on {invoice_number} for {amount}.",
  invoice,
  client,
  sender: { name: "Avery", company: "Overdue", email: "avery@ledger.app" },
  aiEnabled: false,
}

describe("renderTemplate", () => {
  it("replaces all placeholder keys", () => {
    const out = renderTemplate("Hello {client_name} ({invoice_number})", {
      "{client_name}": "Acme",
      "{invoice_number}": "INV-9",
    })
    expect(out).toBe("Hello Acme (INV-9)")
  })

  it("trims whitespace", () => {
    expect(renderTemplate("  padded  ", {})).toBe("padded")
  })
})

describe("draftLocally", () => {
  it("renders a deterministic subject and body", () => {
    const out = draftLocally(baseInput)
    expect(out.subject).toBe("Reminder: invoice INV-001")
    expect(out.body).toContain("Acme Co")
    expect(out.body).toContain("INV-001")
    expect(out.body).toContain("$123.45")
    expect(out.aiUsed).toBe(false)
  })

  it("substitutes a default client name when none is present", () => {
    const out = draftLocally({ ...baseInput, client: null })
    expect(out.body).toContain("there")
  })

  it("renders a zero balance from the {balance} placeholder", () => {
    const out = draftLocally({
      ...baseInput,
      bodyTemplate: "Balance due: {balance}.",
      invoice: { ...invoice, paid_cents: 12345 },
    })
    expect(out.body).toContain("$0.00")
  })
})

describe("draftEmail", () => {
  const prevKey = process.env.LLM_API_KEY
  afterEach(() => {
    if (prevKey === undefined) delete process.env.LLM_API_KEY
    else process.env.LLM_API_KEY = prevKey
  })

  it("falls back to local drafting when no LLM key is set", async () => {
    delete process.env.LLM_API_KEY
    const out = await draftEmail({ ...baseInput, aiEnabled: true })
    expect(out.aiUsed).toBe(false)
    expect(out.body).toContain("Acme Co")
  })

  it("never calls the LLM when aiEnabled is false", async () => {
    process.env.LLM_API_KEY = "test-key"
    const out = await draftEmail({ ...baseInput, aiEnabled: false })
    expect(out.aiUsed).toBe(false)
  })
})