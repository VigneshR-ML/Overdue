import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/** Anonymous liveness probe for uptime monitors. No secrets, no DB writes. */
export async function GET() {
  return NextResponse.json(
    { ok: true, service: "overdue", time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  )
}
