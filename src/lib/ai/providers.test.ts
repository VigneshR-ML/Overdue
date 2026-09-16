import { afterEach, describe, expect, it, vi } from "vitest"
import { chatJsonWithFallback, llmProviders } from "@/lib/ai/providers"

const KEYS = ["LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL", "LLM_API_GROQ", "LLM_GROQ_BASE_URL", "LLM_GROQ_MODEL", "LLM_FALLBACK_API_KEY", "LLM_FALLBACK_BASE_URL", "LLM_FALLBACK_MODEL"] as const

const saved = new Map<string, string | undefined>()
function stash() {
  for (const k of KEYS) saved.set(k, process.env[k])
}
function restore() {
  for (const k of KEYS) {
    const v = saved.get(k)
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
}
function useEnv(vars: Record<string, string>) {
  for (const k of KEYS) delete process.env[k]
  for (const [k, v] of Object.entries(vars)) process.env[k] = v
}

function fakeRes(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

afterEach(() => {
  restore()
  vi.unstubAllGlobals()
})

describe("llmProviders", () => {
  it("builds primary → groq → fallback in order", () => {
    stash()
    useEnv({
      LLM_API_KEY: "pk1",
      LLM_API_GROQ: "gsk_1",
      LLM_FALLBACK_API_KEY: "fb1",
      LLM_BASE_URL: "https://primary.example/v1/",
      LLM_MODEL: "m1",
    })
    const list = llmProviders()
    expect(list.map((p) => p.label)).toEqual(["primary", "groq", "fallback"])
    expect(list[0].baseUrl).toBe("https://primary.example/v1")
    expect(list[1].baseUrl).toBe("https://api.groq.com/openai/v1")
    expect(list[2].model).toBe("openai/gpt-oss-20b")
  })

  it("returns an empty list when no keys are configured", () => {
    stash()
    useEnv({})
    expect(llmProviders()).toEqual([])
  })
})

describe("chatJsonWithFallback", () => {
  it("uses the first provider that returns a usable completion", async () => {
    stash()
    useEnv({
      LLM_API_KEY: "k1",
      LLM_BASE_URL: "https://one.example/v1",
      LLM_MODEL: "m1",
      LLM_API_GROQ: "gsk_2",
    })
    const fetchMock = vi.fn().mockResolvedValueOnce(
      fakeRes({ choices: [{ message: { content: JSON.stringify({ ok: true }) } }] }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { value, providerLabel } = await chatJsonWithFallback(
      { messages: [], maxTokens: 10 },
      (p) => (p as { ok?: boolean }).ok ? { ok: true as const } : null,
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(providerLabel).toBe("primary")
    expect(value).toEqual({ ok: true })
  })

  it("falls through to the next provider when the first errors", async () => {
    stash()
    useEnv({
      LLM_API_KEY: "k1",
      LLM_BASE_URL: "https://one.example/v1",
      LLM_MODEL: "m1",
      LLM_API_GROQ: "gsk_2",
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeRes({ error: "boom" }, 429))
      .mockResolvedValueOnce(
        fakeRes({ choices: [{ message: { content: JSON.stringify({ ok: true }) } }] }),
      )
    vi.stubGlobal("fetch", fetchMock)

    const { value, providerLabel } = await chatJsonWithFallback(
      { messages: [], maxTokens: 10 },
      (p) => (p as { ok?: boolean }).ok ? { ok: true as const } : null,
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(providerLabel).toBe("groq")
    expect(value).toEqual({ ok: true })
  })

  it("tries the next provider when a completion is unusable", async () => {
    stash()
    useEnv({
      LLM_API_KEY: "k1",
      LLM_BASE_URL: "https://one.example/v1",
      LLM_MODEL: "m1",
      LLM_API_GROQ: "gsk_2",
    })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        fakeRes({ choices: [{ message: { content: JSON.stringify({ ok: false }) } }] }),
      )
      .mockResolvedValueOnce(
        fakeRes({ choices: [{ message: { content: JSON.stringify({ ok: true }) } }] }),
      )
    vi.stubGlobal("fetch", fetchMock)

    const { value, providerLabel } = await chatJsonWithFallback(
      { messages: [], maxTokens: 10 },
      (p) => (p as { ok?: boolean }).ok ? { ok: true as const } : null,
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(providerLabel).toBe("groq")
    expect(value).toEqual({ ok: true })
  })

  it("returns null when every provider fails", async () => {
    stash()
    useEnv({
      LLM_API_KEY: "k1",
      LLM_BASE_URL: "https://one.example/v1",
      LLM_MODEL: "m1",
      LLM_API_GROQ: "gsk_2",
    })
    const fetchMock = vi.fn().mockResolvedValue(fakeRes({ error: "boom" }, 500))
    vi.stubGlobal("fetch", fetchMock)

    const { value, providerLabel } = await chatJsonWithFallback(
      { messages: [], maxTokens: 10 },
      () => ({ payload: true }),
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(providerLabel).toBeNull()
    expect(value).toBeNull()
  })
})