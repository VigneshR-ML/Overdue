import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { setCredentials, getOAuthConfig } from "@/lib/integrations/credentials"
import { verifyState, appUrl } from "@/lib/integrations/oauth"
import { syncUserProvider } from "@/lib/integrations/sync"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const errorParam = request.nextUrl.searchParams.get("error")
  const state = request.nextUrl.searchParams.get("state") ?? ""

  if (errorParam) {
    return NextResponse.redirect(`${appUrl()}/settings/integrations?stripe=denied`)
  }
  if (!code) return NextResponse.redirect(`${appUrl()}/settings/integrations?stripe=missing_code`)

  const userId = verifyState(state)
  if (!userId) return NextResponse.redirect(`${appUrl()}/settings/integrations?stripe=bad_state`)

  const cfg = getOAuthConfig("stripe")
  try {
    const tokenRes = await fetch("https://connect.stripe.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        code,
      }),
    })
    const token = await tokenRes.json()
    if (!tokenRes.ok) throw new Error(token.error_description ?? token.error ?? tokenRes.statusText)

    const credErr = await setCredentials(userId, "stripe", {
      access_token: token.access_token,
      stripe_user_id: token.stripe_user_id ?? "",
      refresh_token: token.refresh_token ?? "",
      publishable_key: token.stripe_publishable_key ?? "",
    })
    if (credErr) throw new Error(credErr.message)

    const supabase = createClient()
    await supabase.from("integrations").upsert(
      {
        user_id: userId,
        provider: "stripe",
        status: "connected",
        display_name: (token.stripe_user_id ?? "Stripe account").slice(0, 60),
      },
      { onConflict: "user_id,provider" },
    )

    try {
      await syncUserProvider(userId, "stripe")
    } catch {
      // first sync can race with account setup; report via last_synced state
    }

    return NextResponse.redirect(`${appUrl()}/settings/integrations?stripe=connected`)
  } catch (e) {
    return NextResponse.redirect(`${appUrl()}/settings/integrations?stripe=error:${encodeURIComponent((e as Error).message)}`)
  }
}