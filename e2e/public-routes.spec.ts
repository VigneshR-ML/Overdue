import { expect, test } from "@playwright/test"

const routes = [
  { path: "/", title: /Overdue/, heading: /Get paid without/ },
  { path: "/pricing", title: /Pricing/, heading: /follow-up autopilot/ },
  { path: "/templates", title: /templates/, heading: /Invoice emails/ },
  { path: "/login", title: /Sign in/, heading: /Welcome back/ },
  { path: "/signup", title: /Create account/, heading: /Start free/ },
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
