import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { setCredentials, getOAuthConfig } from "@/lib/integrations/credentials"
import { verifyState, appUrl } from "@/lib/integrations/oauth"
import { getPlan } from "@/lib/billing/plan"
import { syncUserProvider } from "@/lib/integrations/sync"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state") ?? ""

  if (!code) return NextResponse.redirect(`${appUrl()}/settings/integrations?xero=missing_code`)

  const userId = verifyState(state)
  if (!userId) return NextResponse.redirect(`${appUrl()}/settings/integrations?xero=bad_state`)

  const plan = await getPlan(userId)
  if (plan === "free") {
    return NextResponse.redirect(`${appUrl()}/settings/integrations?upgrade=1`)
  }

  const cfg = getOAuthConfig("xero")
  try {
    const tokenRes = await fetch("https://identity.xero.com/connect/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        code,
        redirect_uri: `${appUrl()}/api/integrations/xero/callback`,
      }),
    })
    const token = await tokenRes.json()
    if (!tokenRes.ok || !token.access_token) {
      throw new Error(token.error_description ?? token.error ?? "token exchange failed")
    }

    // Xero tenants: pick the first active connection.
    const connRes = await fetch("https://api.xero.com/connections", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    })
    const connections = await connRes.json()
    const tenantId = connections?.[0]?.tenantId ?? ""

    const credErr = await setCredentials(userId, "xero", {
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? "",
      expires_at: String(Date.now() + (token.expires_in ?? 1800) * 1000),
      tenant_id: tenantId,
    })
    if (credErr) throw new Error(credErr.message)

    const supabase = createClient()
    await supabase.from("integrations").upsert(
      {
        user_id: userId,
        provider: "xero",
        status: "connected",
        display_name: connections?.[0]?.tenantName ?? "Xero",
        // Lets /api/webhooks/xero map tenantId → owner for paid detection.
        provider_account_id: tenantId || null,
      },
      { onConflict: "user_id,provider" },
    )

    try {
      await syncUserProvider(userId, "xero")
    } catch {
      // tolerate first-sync races
    }

    return NextResponse.redirect(`${appUrl()}/settings/integrations?xero=connected`)
  } catch (e) {
    return NextResponse.redirect(
      `${appUrl()}/settings/integrations?xero=error:${encodeURIComponent((e as Error).message)}`,
    )
  }
}