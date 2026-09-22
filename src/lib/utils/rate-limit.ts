import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

/**
 * Distributed sliding-window rate limiter keyed in Upstash Redis.
 *
 * In production (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set) the
 * limit is enforced across instances/serverless invocations. Without those
 * env vars — local dev and the unit suite — it degrades to the in-memory
 * limiter below so behavior is identical on one instance. A transient Upstash
 * outage also degrades rather than erroring out every authed route.
 */

const useUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

const redis = useUpstash
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
  : null

const limiters = new Map<string, Ratelimit>()

function limiterFor(limit: number, windowMs: number): Ratelimit | null {
  const key = `${limit}:${windowMs}`
  let found = limiters.get(key)
  if (!found) {
    found = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: "rate",
    })
    limiters.set(key, found)
  }
  return found
}

/**
 * In-memory fallback (fixed window). `.unref()` so the cleaner timer never
 * keeps a short-lived process (tests, serverless) alive.
 */
const store = new Map<string, { count: number; resetAt: number }>()

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

function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
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

/**
 * Check + increment a rate limit bucket.
 * @param key   unique identifier (e.g. `${ip}:${route}` or `${userId}:${route}`)
 * @param limit max requests in the window
 * @param windowMs sliding window size in milliseconds
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (!redis) return memoryLimit(key, limit, windowMs)

  const limiter = limiterFor(limit, windowMs)
  if (!limiter) return memoryLimit(key, limit, windowMs)

  try {
    const res = await limiter.limit(key)
    return { allowed: res.success, remaining: res.remaining, resetMs: Math.max(0, res.reset - Date.now()) }
  } catch {
    return memoryLimit(key, limit, windowMs)
  }
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