import { beforeEach, describe, expect, it, vi } from "vitest"

const createBrowserClient = vi.fn(() => ({ auth: {} }))

vi.mock("@supabase/ssr", () => ({ createBrowserClient }))

describe("browser Supabase client", () => {
  beforeEach(() => {
    vi.resetModules()
    createBrowserClient.mockClear()
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test"
  })

  it("leaves callback URL exchange to the explicit auth handler", async () => {
    const { createClient } = await import("./client")
    createClient()

    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-test",
      { auth: { detectSessionInUrl: false } },
    )
  })
})
