import { expect, test } from "@playwright/test"

const routes = [
  { path: "/", title: /Accounts Receivable Automation/, heading: /Your client missed the due date/ },
  { path: "/pricing", title: /Pricing/, heading: /follow-up autopilot/ },
  { path: "/templates", title: /templates/, heading: /Invoice emails/ },
  { path: "/login", title: /Sign in/, heading: /Welcome back/ },
  { path: "/signup", title: /Create account/, heading: /Start your 14-day trial/ },
]

test("public routes render cleanly and fit a tablet viewport", async ({ page }) => {
  const pageErrors: string[] = []
  page.on("pageerror", (error) => pageErrors.push(error.message))

  await page.setViewportSize({ width: 800, height: 600 })
  for (const route of routes) {
    const response = await page.goto(route.path, { waitUntil: "networkidle" })
    expect(response?.ok(), route.path).toBe(true)
    await expect(page).toHaveTitle(route.title)
    await expect(page.getByRole("heading", { level: 1 })).toContainText(route.heading)
    await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0)
    await expect(page.locator("body")).not.toContainText("This page couldn’t load")
  }

  await page.goto("/", { waitUntil: "networkidle" })
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }))
  expect(widths.scroll).toBeLessThanOrEqual(widths.client)
  expect(pageErrors).toEqual([])
})

test("auth pages keep account creation and sign in distinct", async ({ page }) => {
  await page.goto("/signup")
  await expect(page.getByLabel("Email")).toBeVisible()
  await expect(page.getByLabel("Password")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Email me a secure link" })).toBeVisible()

  await page.goto("/login")
  await expect(page.getByLabel("Email")).toBeVisible()
  await expect(page.getByLabel("Password")).toBeVisible()
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Create a free account" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Forgot your password?" })).toBeVisible()
})

test("indexable marketing pages expose a single canonical, one H1, and useful metadata", async ({ page }) => {
  const indexableRoutes = [
    "/",
    "/payment-reminder-software",
    "/invoice-follow-up-software",
    "/usd-invoice-follow-up",
    "/templates",
    "/pricing",
    "/recovery-score",
    "/partners",
    "/about",
    "/for/agencies",
    "/for/consultants",
    "/for/msps",
    "/for/freelancers",
  ]

  for (const route of indexableRoutes) {
    const response = await page.goto(route, { waitUntil: "networkidle" })
    expect(response?.ok(), route).toBe(true)
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/)
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
    await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute("content", /noindex/i)
  }
})

test("SEO endpoints list only canonical public pages and legacy URLs redirect directly", async ({ page }) => {
  const [robots, sitemap, legacyAgency, legacyFreelancer, missing] = await Promise.all([
    page.request.get("/robots.txt"),
    page.request.get("/sitemap.xml"),
    page.request.get("/for-agencies", { maxRedirects: 0 }),
    page.request.get("/for-freelancers", { maxRedirects: 0 }),
    page.request.get("/not-a-real-overdue-page"),
  ])

  expect(robots.ok()).toBe(true)
  const robotsText = await robots.text()
  expect(robotsText).toContain("Allow: /")
  expect(robotsText).not.toMatch(/^Disallow: \/$/m)

  const sitemapText = await sitemap.text()
  expect(sitemap.ok()).toBe(true)
  expect(sitemapText).toContain("/payment-reminder-software")
  expect(sitemapText).toContain("/invoice-follow-up-software")
  expect(sitemapText).toContain("/usd-invoice-follow-up")
  expect(sitemapText).toContain("/about")
  expect(sitemapText).not.toContain("/signup")
  expect(sitemapText).not.toContain("/for-agencies")
  expect(sitemapText).not.toContain("/for-freelancers")

  expect(legacyAgency.status()).toBe(308)
  expect(legacyAgency.headers().location).toMatch(/\/for\/agencies$/)
  expect(legacyFreelancer.status()).toBe(308)
  expect(legacyFreelancer.headers().location).toMatch(/\/for\/freelancers$/)
  expect(missing.status()).toBe(404)
})

test("marketing internal links do not resolve to 404 pages", async ({ page }) => {
  const sourceRoutes = [
    "/",
    "/payment-reminder-software",
    "/invoice-follow-up-software",
    "/usd-invoice-follow-up",
    "/templates",
    "/pricing",
    "/recovery-score",
    "/partners",
    "/about",
    "/for/agencies",
    "/for/consultants",
    "/for/msps",
    "/for/freelancers",
  ]
  const links = new Set<string>()

  for (const route of sourceRoutes) {
    await page.goto(route, { waitUntil: "networkidle" })
    for (const href of await page.locator('a[href^="/"]').evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href") ?? ""))) {
      const path = href.replace(/#.*/, "") || "/"
      if (!path.startsWith("//")) links.add(path)
    }
  }

  const responses = await Promise.all([...links].map(async (path) => ({ path, response: await page.request.get(path) })))
  expect(responses.filter(({ response }) => response.status() >= 400).map(({ path, response }) => `${path} (${response.status()})`)).toEqual([])
})
