import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  const rl = rateLimit(`sender:${user!.id}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Too many updates. Try again shortly." }, { status: 429 })
  }

  let body: { senderName?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 })
  }

  const senderName = typeof body.senderName === "string" ? body.senderName.trim() : ""
  if (!senderName || senderName.length > 80) {
    return NextResponse.json({ ok: false, error: "Sender name must be between 1 and 80 characters." }, { status: 400 })
  }

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 })
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ full_name: senderName })
    .eq("id", user!.id)

  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })
  return NextResponse.json({ ok: true, senderName })
}
