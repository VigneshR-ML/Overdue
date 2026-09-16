import { test, expect } from "@playwright/test"

/**
 * UI smoke suite for Overdue — public surfaces, the ladder preview, and the
 * auth middleware redirect regressions (unauthenticated app routes must
 * bounce to /?signin=1, never 500).
 *
 * Authed routes (/dashboard, /sequences/:id, …) need a real Supabase session,
 * so they live in a separate spec that reads a storageState when provided.
 */

/** Dev-mode artifact: the intentional CSP blocks Vercel's injected analytics scripts.
 *  Whitelisted so it doesn't mask real app errors. */
const KNOWN_CSP_WARNINGS = /vercel-scripts\.com|Content Security Policy/i

/** Route → the heading text we expect to see, used as a 'page actually rendered' beacon. */
const PUBLIC_PAGES: { path: string; beacon: string }[] = [
  { path: "/", beacon: "Get paid without" },
  { path: "/pricing", beacon: "One recovering invoice pays for the year" },
  { path: "/login", beacon: "Welcome back to the" },
  { path: "/signup", beacon: "" },
  { path: "/templates", beacon: "Invoice emails that don't" },
  { path: "/terms", beacon: "" },
  { path: "/privacy", beacon: "" },
  { path: "/security", beacon: "" },
  { path: "/refund", beacon: "" },
]

/** App routes that must redirect to /?signin=1 when not authenticated. */
const PROTECTED_ROUTES = [
  "/dashboard",
  "/invoices",
  "/clients",
  "/sequences",
  "/sequences/new",
  "/insights",
  "/settings",
  "/tools",
]

test.describe("smoke", () => {
  for (const { path, beacon } of PUBLIC_PAGES) {
    test(`renders ${path} with no console errors`, async ({ page }) => {
      const errors: string[] = []
      page.on("console", (msg) => {
        if (msg.type() === "error" && !KNOWN_CSP_WARNINGS.test(msg.text())) errors.push(msg.text())
      })
      page.on("pageerror", (err) => errors.push(err.message))

      const res = await page.goto(path)
      expect(res?.status()).toBe(200)
      await expect(page.locator("h1")).toHaveCount(1)
      await page.waitForLoadState("networkidle")

      if (beacon) {
        await expect(page.getByRole("heading", { name: new RegExp(beacon, "i") }).first()).toBeVisible()
      }

      expect(errors, `console/page errors on ${path}`).toEqual([])
    })
  }

  test("template ladder preview renders all four rungs read-only", async ({ page }) => {
    await page.goto("/templates/late-payment-reminder-email")
    const rungs = page.getByRole("button", { name: /Step \d —/ })
    await expect(rungs).toHaveCount(4)
    // signature temperature rail present
    await expect(page.locator("ol.relative")).toBeVisible()
    // copy button is the only interactive control
    await expect(page.getByRole("button", { name: /copy/i }).first()).toBeVisible()
  })

  test("unknown public route returns a 404 page", async ({ page }) => {
    const res = await page.goto("/definitely-not-a-real-page")
    expect(res?.status()).toBe(404)
    await expect(page.locator("body")).toContainText(/isn't on the ledger|404/)
  })
})

test.describe("auth middleware redirect", () => {
  for (const path of PROTECTED_ROUTES) {
    test(`${path} → /?signin=1 when logged out`, async ({ page }) => {
      const res = await page.goto(path, { waitUntil: "networkidle" })
      // previous bug class: unauthenticated visits 500'd; now they must 307→200
      expect(res?.status()).toBe(200)
      await page.waitForURL((url) => url.pathname === "/" && url.searchParams.get("signin") === "1")
    })
  }
})