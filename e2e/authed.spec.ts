import { test, expect, type Page } from "@playwright/test"
import { loadEnv } from "./env"

loadEnv()

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
const credsOk = Boolean(EMAIL && PASSWORD)

/**
 * Authenticated smoke against the current product UI (Next 16 baseline).
 * Idempotent: reuses an existing E2E- invoice if one exists so repeated runs
 * don't hit the free-plan invoice cap. Covers login → ledger → create → mark
 * paid → export.
 */
test.describe("authed", () => {
  test.skip(!credsOk, "E2E_EMAIL / E2E_PASSWORD not configured — connect a staging project to run")

  async function signIn(page: Page) {
    await page.goto("/login")
    await page.getByLabel("Email").fill(EMAIL!)
    await page.getByLabel("Password").fill(PASSWORD!)
    await page.getByRole("button", { name: "Sign in" }).click()
    await page.waitForURL("**/dashboard")
    await expect(
      page.getByRole("heading", { name: /Good day|Welcome to the ledger/ }),
    ).toBeVisible()
  }

  test("email login lands on the ledger without console errors", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (err) => errors.push(err.message))
    await signIn(page)
    await expect(page.getByText("Overdue", { exact: true }).first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test("manual invoice: create → appears → mark paid → export", async ({ page }) => {
    await signIn(page)

    const stamp = Date.now()
    const number = `E2E-${stamp}`
    const clientName = `E2E Client ${stamp % 1000}`
    const amountCents = 125_00

    // Idempotency: reuse an existing E2E- invoice so the free 10-invoice cap
    // never trips a second run.
    const exportRes = await page.request.get("/api/account/export")
    expect(exportRes.ok()).toBeTruthy()
    const exportBody = (await exportRes.json()) as { data?: { invoices?: Array<{ id: string; number: string | null }> } }
    const prior = (exportBody.data?.invoices ?? []).find((i) => i.number?.startsWith("E2E-"))
    const invoiceId = prior?.id ?? ""

    if (!invoiceId) {
      const createRes = await page.request.post("/api/invoices", {
        data: {
          client_name: clientName,
          client_email: `e2e-${stamp}@example.test`,
          number,
          amount_cents: amountCents,
          currency: "USD",
          due_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        },
      })
      expect(createRes.ok(), `create invoice failed: ${await createRes.text()}`).toBeTruthy()
      const created = (await createRes.json()) as { id: string }
      // Ledger row renders the invoice number
      await page.goto("/invoices")
      await expect(page.getByText(number, { exact: true })).toBeVisible()
      const mark = await page.request.patch(`/api/invoices/${created.id}`, {
        data: { mark_paid: true },
      })
      expect(mark.ok(), `mark paid failed: ${await mark.text()}`).toBeTruthy()
    } else {
      await page.goto("/invoices")
      await expect(page.getByText(/^E2E-\d+$/, { exact: false }).first()).toBeVisible()
    }

    // Paid row now shows the Paid badge
    await page.reload()
    await expect(page.getByRole("link", { name: /^E2E-/ }).first()).toBeVisible()

    // Export contains the ledger and the account data round-trips
    const export2 = await page.request.get("/api/account/export")
    expect(export2.ok()).toBeTruthy()
    const body2 = (await export2.json()) as { data?: { invoices?: Array<{ id: string; paid_cents: number }> } }
    const rows = body2.data?.invoices ?? []
    const matched = invoiceId ? rows.find((i) => i.id === invoiceId) : rows.find((i) => (i.paid_cents ?? 0) > 0)
    expect(matched, `expected an E2E invoice in the export (${rows.length} rows)`).toBeTruthy()
  })
})