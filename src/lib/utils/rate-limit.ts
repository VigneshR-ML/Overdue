/**
 * Simple in-memory sliding-window rate limiter for API routes.
 * Key by IP + route or user ID. Sufficient for single-instance serverless.
 * For multi-instance, swap to Upstash Redis.
 */

const store = new Map<string, { count: number; resetAt: number }>()

// Clean up expired entries every 5 minutes to prevent memory leak. `.unref()`
// so the timer never keeps a short-lived process (tests, serverless) alive.
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key)
  }
}, 5 * 60 * 1000).unref()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetMs: number
}

/**
 * Check + increment a rate limit bucket.
 * @param key   unique identifier (e.g. `${ip}:${route}`)
 * @param limit max requests in the window
 * @param windowMs sliding window size in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetMs: windowMs }
  }

  entry.count++
  const remaining = Math.max(0, limit - entry.count)
  const resetMs = Math.max(0, entry.resetAt - now)

  return { allowed: entry.count <= limit, remaining, resetMs }
}

/** Rate limit presets for different endpoint types. */
export const RATE_LIMITS = {
  /** AI draft endpoint: 10 requests per minute per user */
  aiDraft: { limit: 10, windowMs: 60_000 },
  /** Account deletion: 3 requests per hour per user */
  accountDelete: { limit: 3, windowMs: 3_600_000 },
  /** CSV import: 5 requests per minute per user */
  csvImport: { limit: 5, windowMs: 60_000 },
  /** General API: 60 requests per minute per user */
  api: { limit: 60, windowMs: 60_000 },
  /** Cron: 10 requests per minute (protects against leaked secret) */
  cron: { limit: 10, windowMs: 60_000 },
} as const
