export interface LlmProvider {
  apiKey: string
  baseUrl: string
  model: string
  label: string
}

const clean = (url: string | undefined, fallback: string) => (url ?? fallback).replace(/\/+$/, "")

export function llmProviders(): LlmProvider[] {
  const out: LlmProvider[] = []

  const primaryKey = process.env.LLM_API_KEY
  if (primaryKey) {
    out.push({
      apiKey: primaryKey,
      baseUrl: clean(process.env.LLM_BASE_URL, "https://api.openai.com/v1"),
      model: process.env.LLM_MODEL || "gpt-4o-mini",
      label: "primary",
    })
  }

  const groqKey = process.env.LLM_API_GROQ
  if (groqKey) {
    out.push({
      apiKey: groqKey,
      baseUrl: clean(process.env.LLM_GROQ_BASE_URL, "https://api.groq.com/openai/v1"),
      model: process.env.LLM_GROQ_MODEL || "openai/gpt-oss-20b",
      label: "groq",
    })
  }

  const fallbackKey = process.env.LLM_FALLBACK_API_KEY
  if (fallbackKey) {
    out.push({
      apiKey: fallbackKey,
      baseUrl: clean(process.env.LLM_FALLBACK_BASE_URL, "https://api.groq.com/openai/v1"),
      model: process.env.LLM_FALLBACK_MODEL || "openai/gpt-oss-20b",
      label: "fallback",
    })
  }

  return out
}

export interface ChatJsonOptions {
  messages: { role: string; content: string }[]
  temperature?: number
  maxTokens: number
}

export async function chatJsonWithFallback<T>(
  options: ChatJsonOptions,
  validate: (parsed: unknown) => T | null,
): Promise<{ value: T | null; providerLabel: string | null }> {
  for (const provider of llmProviders()) {
    try {
      const res = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: provider.model,
          messages: options.messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
          response_format: { type: "json_object" },
        }),
        next: { revalidate: 0 },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
      const raw = json?.choices?.[0]?.message?.content ?? ""
      const parsed = JSON.parse(raw)
      const value = validate(parsed)
      if (value !== null) return { value, providerLabel: provider.label }
    } catch (e) {
      console.error(`[llm] ${provider.label} (${provider.model}) failed:`, (e as Error).message)
    }
  }
  return { value: null, providerLabel: null }
}