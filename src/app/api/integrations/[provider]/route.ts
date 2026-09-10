import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { syncUserProvider } from "@/lib/integrations/sync"
import { deleteCredentials } from "@/lib/integrations/credentials"
import { createClient } from "@/lib/supabase/server"
import { getPlan } from "@/lib/billing/plan"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"

export const dynamic = "force-dynamic"

const PROVIDERS = ["stripe", "paypal", "xero"] as const
type Provider = (typeof PROVIDERS)[number]

function asProvider(p: string | null): Provider | null {
  return PROVIDERS.includes(p as Provider) ? (p as Provider) : null
}

/** POST /api/integrations/[provider]/sync */
export async function POST(_req: NextRequest, { params }: { params: { provider: string } }) {
  const { user, error } = await requireUser()
  if (error) return error

  const rl = rateLimit(`provider-sync:${user!.id}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  const provider = asProvider(params.provider)
  if (!provider) return NextResponse.json({ ok: false, error: "unknown provider" }, { status: 400 })

  const plan = await getPlan(user!.id)
  if (plan === "free") {
    return NextResponse.json(
      { ok: false, error: "Automated sync is a Pro feature — upgrade to connect invoicing sources." },
      { status: 403 },
    )
  }

  const result = await syncUserProvider(user!.id, provider)
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 })

  return NextResponse.json({ ok: true, result: result.result })
}

/** DELETE /api/integrations/[provider]/disconnect */
export async function DELETE(_req: NextRequest, { params }: { params: { provider: string } }) {
  const { user, error } = await requireUser()
  if (error) return error

  const provider = asProvider(params.provider)
  if (!provider) return NextResponse.json({ ok: false, error: "unknown provider" }, { status: 400 })

  await deleteCredentials(user!.id, provider)

  const supabase = createClient()
  await supabase.from("integrations").delete().eq("user_id", user!.id).eq("provider", provider)

  // Soft-delete synced invoices to prevent orphaned escalation emails.
  await supabase
    .from("invoices")
    .update({ status: "overdue", line_item_summary: null })
    .eq("user_id", user!.id)
    .eq("provider", provider)
    .not("status", "eq", "paid")

  return NextResponse.json({ ok: true })
}