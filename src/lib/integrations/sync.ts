import { createAdminClient } from "@/lib/supabase/admin"
import { getCredentials, setCredentials, getOAuthConfig } from "./credentials"
import { syncStripeInvoices } from "./stripe"
import { syncPaypalInvoices } from "./paypal"
import { syncXeroInvoices } from "./xero"
import { attachDefaultRuns } from "@/lib/scheduler/dispatch"
import type { InboundInvoice, SyncResult } from "./provider"

const refreshMutex = new Map<string, Promise<void>>()

export async function withRefreshMutex<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = refreshMutex.get(key)
  const chain = (prev ?? Promise.resolve()).then(fn, fn)
  refreshMutex.set(key, chain.then(() => {}, () => {}))
  return chain
}

async function refreshXeroIfNeeded(userId: string) {
  const creds = await getCredentials(userId, "xero")
  if (!creds?.refresh_token) return
  const expiresAt = Number(creds.expires_at ?? 0)
  if (expiresAt > Date.now() + 5 * 60 * 1000) return

  await withRefreshMutex(`xero:${userId}`, async () => {
    const fresh = await getCredentials(userId, "xero")
    if (!fresh?.refresh_token) return
    const freshExpiry = Number(fresh.expires_at ?? 0)
    if (freshExpiry > Date.now() + 5 * 60 * 1000) return

    const cfg = getOAuthConfig("xero")
    try {
      const res = await fetch("https://identity.xero.com/connect/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          refresh_token: fresh.refresh_token,
        }),
      })
      const token = await res.json()
      if (res.ok && token.access_token) {
        await setCredentials(userId, "xero", {
          ...fresh,
          access_token: token.access_token,
          refresh_token: token.refresh_token ?? fresh.refresh_token,
          expires_at: String(Date.now() + (token.expires_in ?? 1800) * 1000),
          tenant_id: fresh.tenant_id ?? "",
        })
      } else {
        console.error("[sync] Xero token refresh failed:", res.status, token)
      }
    } catch (e) {
      console.error("[sync] Xero token refresh error:", e)
    }
  })
}

async function refreshStripeIfNeeded(userId: string) {
  const creds = await getCredentials(userId, "stripe")
  if (!creds?.refresh_token) return

  const expiresAt = Number(creds.expires_at ?? 0)
  if (expiresAt > Date.now() + 5 * 60 * 1000) return

  await withRefreshMutex(`stripe:${userId}`, async () => {
    const fresh = await getCredentials(userId, "stripe")
    if (!fresh?.refresh_token) return

    const cfg = getOAuthConfig("stripe")
    try {
      const res = await fetch("https://connect.stripe.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          refresh_token: fresh.refresh_token,
        }),
      })
      const token = await res.json()
      if (res.ok && token.access_token) {
        await setCredentials(userId, "stripe", {
          ...fresh,
          access_token: token.access_token,
          refresh_token: token.refresh_token ?? fresh.refresh_token,
        })
      } else {
        console.error("[sync] Stripe token refresh failed:", res.status, token)
      }
    } catch (e) {
      console.error("[sync] Stripe token refresh error:", e)
    }
  })
}

export async function syncUserProvider(userId: string, provider: "stripe" | "paypal" | "xero") {
  const admin = createAdminClient()
  if (!admin) return { ok: false, error: "supabase not configured" }

  if (provider === "xero") await refreshXeroIfNeeded(userId)
  if (provider === "stripe") await refreshStripeIfNeeded(userId)

  const creds = await getCredentials(userId, provider)
  if (!creds) return { ok: false, error: "provider not connected" }

  let fetched: { invoices: InboundInvoice[]; errors: string[] }

  if (provider === "stripe") {
    fetched = await syncStripeInvoices(creds.access_token)
  } else if (provider === "paypal") {
    fetched = await syncPaypalInvoices(creds.client_id, creds.client_secret, creds.mode ?? "sandbox")
  } else {
    fetched = await syncXeroInvoices(creds.access_token, creds.tenant_id)
  }

  const result: SyncResult = { added: 0, updated: 0, errors: [...fetched.errors] }

  // Upsert clients first so invoices can link.
  const clientIds = new Map<string, string>()
  for (const inv of fetched.invoices) {
    if (!inv.client_name && !inv.client_email) continue
    const key = (inv.client_email ?? inv.client_name ?? inv.provider_id).toLowerCase()
    const clientKey = inv.client_email ? `email:${inv.client_email.toLowerCase()}` : `name:${inv.client_name!.toLowerCase()}`
    if (clientIds.has(clientKey)) continue

    const { data: existing } = await admin
      .from("clients")
      .select("id")
      .eq("user_id", userId)
      .eq("billing_email", inv.client_email ?? "")
      .maybeSingle()

    let clientId = existing?.id as string | undefined
    if (!clientId) {
      const { data: created, error } = await admin
        .from("clients")
        .insert({
          user_id: userId,
          name: inv.client_name ?? inv.client_email ?? "Unknown client",
          email: inv.client_email ?? null,
          billing_email: inv.client_email ?? null,
        })
        .select("id")
        .single()
      if (!error && created) clientId = created.id as string
    }
    if (clientId) clientIds.set(clientKey, clientId)
  }

  // Upsert invoices with client linkage.
  let added = 0
  let updated = 0
  for (const inv of fetched.invoices) {
    const clientKey = inv.client_email ? `email:${inv.client_email.toLowerCase()}` : inv.client_name ? `name:${inv.client_name.toLowerCase()}` : null
    const clientId = clientKey ? clientIds.get(clientKey) ?? null : null

    // Check for an existing invoice to distinguish added vs updated.
    const { data: exists } = await admin
      .from("invoices")
      .select("id, payment_url")
      .eq("user_id", userId)
      .eq("provider", provider)
      .eq("provider_id", inv.provider_id)
      .maybeSingle()

    const existing = exists as { id: string; payment_url?: string | null } | null
    const { error } = await admin.from("invoices").upsert(
      {
        user_id: userId,
        client_id: clientId,
        provider: inv.provider,
        provider_id: inv.provider_id,
        number: inv.number,
        status: inv.status,
        amount_cents: inv.amount_cents,
        paid_cents: inv.paid_cents,
        currency: inv.currency,
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        paid_at: inv.paid_at,
        line_item_summary: inv.line_item_summary,
        // Never wipe a hand-entered pay link with a provider null.
        payment_url: inv.payment_url ?? existing?.payment_url ?? null,
      },
      { onConflict: "user_id,provider,provider_id" },
    )
    if (!error) {
      if (exists) updated++
      else added++
    } else {
      result.errors.push(error.message)
    }
  }

  // Update integration metadata.
  await admin
    .from("integrations")
    .update({
      status: result.errors.length ? "error" : "connected",
      last_synced_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", provider)

  result.added = added
  result.updated = updated

  // Auto-enroll new invoices in the user's default escalation ladder.
  if (added > 0) {
    try { await attachDefaultRuns(userId) } catch { /* non-critical */ }
  }

  return { ok: true, result }
}