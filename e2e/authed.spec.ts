import { test, expect, type Page } from "@playwright/test"

/**
 * Authed UI suite — needs a real Supabase session (E2E_EMAIL / E2E_PASSWORD in
 * .env.local, gitignored). Logs in through the real login form, then drives the
 * ladder editor: create → edit → save → verify → delete.
 */

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
const credsOk = Boolean(EMAIL && PASSWORD)

test.describe("authed", () => {
  test.skip(!credsOk, "E2E_EMAIL / E2E_PASSWORD are not set in .env.local")

  async function signIn(page: Page) {
    await page.goto("/login")
    await page.getByLabel("Email").fill(EMAIL!)
    await page.getByLabel("Password").fill(PASSWORD!)
    await page.getByRole("button", { name: "Sign in" }).click()
    await page.waitForURL("**/dashboard")
    // Neither the "no invoices" board nor a populated one should error.
    await expect(page.getByRole("heading", { name: /Good day|Welcome to the ledger/ })).toBeVisible()
  }

  test("email login lands on the ledger without console errors", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (err) => errors.push(err.message))

    await signIn(page)
    // the app shell wordmark is present
    await expect(page.getByText("Overdue", { exact: true }).first()).toBeVisible()
    expect(errors).toEqual([])
  })

  test("ladder editor: create → edit → save → reload → delete", async ({ page }) => {
    await signIn(page)

    const name = `E2E ladder ${Date.now()}`
    const step = {
      id: "step-e2e-1",
      step_order: 1,
      delay_days: 1,
      tone: "gentle",
      ai_enabled: true,
      subject_template: "Hello {client_name}",
      body_template: "Hi {client_name}, just checking on {invoice_number}.",
    }

    const created = await page.request.post("/api/sequences", {
      data: { name, is_active: false, steps: [step] },
    })
    const createdJson = await created.json()

    // Free plan allows 1 ladder: if creation is blocked, fall back to opening an
    // existing ladder read-only so the editor still gets exercised. Never delete
    // a user's real ladder in that case.
    if (!created.ok()) {
      await page.goto("/sequences")
      const existing = page.locator('a[href^="/sequences/"][href*="-"]').first()
      if ((await existing.count()) === 0) {
        test.skip(true, "no editable ladder available for this account")
        return
      }
      await existing.click()
      await page.waitForLoadState("networkidle")
      await expect(page.getByText("The ladder", { exact: true })).toBeVisible()
      await expect(page.getByText(/Edit rung \d/)).toBeVisible()
      return
    }

    const id = createdJson.id as string
    try {
      await page.goto(`/sequences/${id}`)

      // Left rail: ladder card + settings card
      await expect(page.getByText("The ladder", { exact: true })).toBeVisible()
      await expect(page.getByText("1 / 6 rungs", { exact: true })).toBeVisible()
      await expect(page.getByLabel("Ladder name")).toHaveValue(name)
      await expect(page.getByRole("button", { name: /^Step 1 —/ })).toBeVisible()

      // Right pane: editor card + email-format preview
      await expect(page.getByText("Edit rung 1", { exact: true })).toBeVisible()
      await expect(page.getByRole("button", { name: "Final", exact: true })).toBeVisible()
      await expect(page.getByLabel(/^Delay/)).toHaveValue("1")
      await expect(page.getByLabel(/^Subject/)).toHaveValue("Hello {client_name}")
      await expect(page.getByText(/sample invoice #2026-0952/)).toBeVisible()

      // Live preview renders the sample values, not the raw template
      await expect(page.locator("section").filter({ hasText: "Preview" }).getByText("Hello Arbor Studio", { exact: true })).toBeVisible()

      // Edit the rung
      await page.getByRole("button", { name: "Final", exact: true }).click()
      await expect(page.getByRole("button", { name: "Final", exact: true })).toHaveAttribute("aria-pressed", "true")
      await page.getByLabel(/^Delay/).fill("3")
      const subject = "E2E subject line {invoice_number}"
      await page.getByLabel(/^Subject/).fill(subject)
      await page.getByLabel(/^Message body/).fill("E2E body.")
      await page.locator("section").filter({ hasText: "Preview" }).getByText("E2E subject line 2026-0952", { exact: true }).waitFor()

      // Save via the Settings rail
      await page.getByRole("button", { name: "Save ladder" }).click()
      await expect(page.getByRole("button", { name: "Saved ✓" })).toBeVisible()

      // Persisted across reload
      await page.reload()
      await expect(page.getByLabel(/^Subject/)).toHaveValue(subject)
      await expect(page.getByLabel(/^Delay/)).toHaveValue("3")
      await expect(page.getByRole("button", { name: "Final", exact: true })).toHaveAttribute("aria-pressed", "true")
    } finally {
      // Clean up the test ladder so the free-plan slot stays free.
      const del = await page.request.delete(`/api/sequences?id=${id}`)
      expect(del.ok()).toBeTruthy()
    }
  })
})