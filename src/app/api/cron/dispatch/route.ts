import { NextResponse, type NextRequest } from "next/server"
import { runDispatcher } from "@/lib/scheduler/dispatch"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Cron endpoint. Called hourly by GitHub Actions (.github/workflows/dispatch.yml)
 * with the CRON_SECRET bearer token. Also supports GET for Vercel Cron compatibility.
 * vercel.json crons are intentionally empty (Vercel Cron needs Pro for hourly).
 * Dispatches every due rung idempotently.
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? ""
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  // Rate limit cron dispatch to protect against leaked secret abuse
  const rl = rateLimit("cron:dispatch", RATE_LIMITS.cron.limit, RATE_LIMITS.cron.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "rate limited" }, { status: 429 })
  }

  try {
    const report = await runDispatcher()
    return NextResponse.json(report)
  } catch (err) {
    console.error("[cron/dispatch] unhandled error:", err)
    return NextResponse.json({ ok: false, error: "internal error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}