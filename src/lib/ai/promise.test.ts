import { describe, expect, it, vi, afterEach } from "vitest"
import { resolvePromiseDate, detectPromiseHeuristic, detectPromise } from "./promise"

const MONDAY = new Date(2026, 8, 14, 12, 0, 0) // Mon Sep 14 2026

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("resolvePromiseDate", () => {
  it("resolves tomorrow and weekdays", () => {
    expect(resolvePromiseDate("will pay tomorrow", MONDAY)).toBe("2026-09-15")
    expect(resolvePromiseDate("pay on Friday", MONDAY)).toBe("2026-09-18")
    expect(resolvePromiseDate("Monday works", MONDAY)).toBe("2026-09-14")
  })

  it("resolves relative and numeric dates", () => {
    expect(resolvePromiseDate("next week", MONDAY)).toBe("2026-09-21")
    expect(resolvePromiseDate("end of week", MONDAY)).toBe("2026-09-18")
    expect(resolvePromiseDate("pay by 09/30", MONDAY)).toBe("2026-09-30")
    expect(resolvePromiseDate("on the 25th", MONDAY)).toBe("2026-09-25")
  })

  it("returns null when no date", () => {
    expect(resolvePromiseDate("thanks, looking into it", MONDAY)).toBeNull()
  })
})

describe("detectPromiseHeuristic", () => {
  it("detects intent + date + amount", () => {
    const out = detectPromiseHeuristic("Sorry, finance will process the $4,800 payment on Friday.", MONDAY)
    expect(out.isPromise).toBe(true)
    expect(out.date).toBe("2026-09-18")
    expect(out.amountCents).toBe(480000)
  })

  it("rejects disputes and vague soon", () => {
    expect(detectPromiseHeuristic("This invoice is wrong, please review.", MONDAY).isPromise).toBe(false)
    expect(detectPromiseHeuristic("Will pay soon, thanks!", MONDAY).isPromise).toBe(false)
  })

  it("rejects date without payment intent", () => {
    expect(detectPromiseHeuristic("Let's meet Friday to discuss.", MONDAY).isPromise).toBe(false)
  })
})

describe("detectPromise (LLM path)", () => {
  it("uses the LLM when keyed", async () => {
    vi.stubEnv("LLM_API_KEY", "k")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ is_promise: true, date: "2026-09-20", amount_cents: 100, note: "pay Sunday" }) } }],
        }),
      })),
    )
    const out = await detectPromise("whatever gibberish means Sunday", MONDAY)
    expect(out).toMatchObject({ isPromise: true, date: "2026-09-20" })
  })

  it("falls back to heuristic when the LLM fails", async () => {
    vi.stubEnv("LLM_API_KEY", "k")
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })))
    const out = await detectPromise("We will pay tomorrow morning.", MONDAY)
    expect(out).toMatchObject({ isPromise: true, date: "2026-09-15" })
  })

  it("empty text is never a promise", async () => {
    await expect(detectPromise("   ", MONDAY)).resolves.toMatchObject({ isPromise: false })
  })
})
