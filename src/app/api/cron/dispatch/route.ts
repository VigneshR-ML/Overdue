import { NextResponse, type NextRequest } from "next/server"
import { runDispatcher } from "@/lib/scheduler/dispatch"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Cron endpoint. Called hourly by GitHub Actions (.github/workflows/dispatch.yml)
 * with the CRON_SECRET bearer token. vercel.json crons are intentionally empty
 * (Vercel Cron needs Pro for hourly). Dispatches every due rung idempotently.
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? ""
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const report = await runDispatcher()
  return NextResponse.json(report)
}