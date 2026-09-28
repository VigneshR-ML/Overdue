import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { getPlan } from "@/lib/billing/plan"
import { getOAuthConfig } from "@/lib/integrations/credentials"
import { signState, appUrl } from "@/lib/integrations/oauth"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"

export const dynamic = "force-dynamic"

/** Starts Xero OAuth2 (Authorization Code + PKCE-less, offline_access for refresh). */
export async function GET() {
  const { user, error } = await requireUser()
  if (error) return error
  const rl = await rateLimit(`integration-start:${user!.id}`, RATE_LIMITS.integrationWrite.limit, RATE_LIMITS.integrationWrite.windowMs)
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "Rate limit exceeded" }, { status: 429 })

  const plan = await getPlan(user!.id)
  if (plan === "free") {
    return NextResponse.redirect(`${appUrl()}/settings/integrations?upgrade=1`)
  }

  const cfg = getOAuthConfig("xero")
  if (!cfg.clientId) {
    return NextResponse.json({ ok: false, error: "XERO_CLIENT_ID not configured" }, { status: 500 })
  }

  const state = signState(user!.id)
  const redirectUri = `${appUrl()}/api/integrations/xero/callback`

  const url = new URL("https://login.xero.com/identity/connect/authorize")
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", cfg.clientId)
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("scope", "accounting.transactions.read accounting.contacts.read offline_access")
  url.searchParams.set("state", state)

  return NextResponse.redirect(url.toString())
}