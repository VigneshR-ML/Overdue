import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { canonicalHost, siteUrl } from "@/lib/site-url"

/**
 * `siteUrl()` decides the canonical origin for metadata, sitemap, robots.txt,
 * the canonical-host redirect in proxy.ts, and every OAuth redirect. It used to
 * be a literal duplicated across five modules with three different fallbacks,
 * including a sitemap fallback of http://localhost:3000 that would have shipped
 * localhost URLs to search engines. These tests pin the contract.
 */

const ORIGINAL_ENV = { ...process.env }

function setEnv(env: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe("siteUrl", () => {
  it("uses NEXT_PUBLIC_APP_URL when configured", () => {
    setEnv({ NEXT_PUBLIC_APP_URL: "https://getoverdue.online" })
    expect(siteUrl()).toBe("https://getoverdue.online")
  })

  it("respects a non-production configured origin (e.g. preview)", () => {
    setEnv({ NEXT_PUBLIC_APP_URL: "https://overdue-abc123.vercel.app" })
    expect(siteUrl()).toBe("https://overdue-abc123.vercel.app")
  })

  it("strips trailing slashes so callers can append '/path' safely", () => {
    setEnv({ NEXT_PUBLIC_APP_URL: "https://getoverdue.online/" })
    expect(siteUrl()).toBe("https://getoverdue.online")
  })

  it("trims surrounding whitespace", () => {
    setEnv({ NEXT_PUBLIC_APP_URL: "  https://getoverdue.online  " })
    expect(siteUrl()).toBe("https://getoverdue.online")
  })

  it("falls back to localhost in development, never to a marketing domain", () => {
    setEnv({ NEXT_PUBLIC_APP_URL: undefined, NODE_ENV: "development" })
    expect(siteUrl()).toBe("http://localhost:3000")
  })

  it("falls back to the apex domain in production, not www", () => {
    setEnv({ NEXT_PUBLIC_APP_URL: undefined, NODE_ENV: "production" })
    // proxy.ts redirects every non-canonical host to this value, so a www
    // fallback would bounce apex traffic onto www — and would not match the
    // Supabase redirect allowlist.
    expect(siteUrl()).toBe("https://getoverdue.online")
  })

  it("falls back to the apex domain when the env var is empty or whitespace", () => {
    setEnv({ NEXT_PUBLIC_APP_URL: "", NODE_ENV: "production" })
    expect(siteUrl()).toBe("https://getoverdue.online")
    setEnv({ NEXT_PUBLIC_APP_URL: "   ", NODE_ENV: "production" })
    expect(siteUrl()).toBe("https://getoverdue.online")
  })

  it("never returns an empty string", () => {
    setEnv({ NEXT_PUBLIC_APP_URL: undefined })
    expect(siteUrl().length).toBeGreaterThan(0)
  })
})

describe("canonicalHost", () => {
  it("strips the protocol for middleware host comparison", () => {
    setEnv({ NEXT_PUBLIC_APP_URL: "https://getoverdue.online" })
    expect(canonicalHost()).toBe("getoverdue.online")
  })

  it("uses only the origin when a configured URL includes a path", () => {
    setEnv({ NEXT_PUBLIC_APP_URL: "https://getoverdue.online/app/" })
    expect(siteUrl()).toBe("https://getoverdue.online")
    expect(canonicalHost()).toBe("getoverdue.online")
  })
})
