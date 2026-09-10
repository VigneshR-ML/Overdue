import { createAdminClient } from "@/lib/supabase/admin"

const PROVIDER = ["stripe", "paypal", "xero"] as const
export type CredProvider = (typeof PROVIDER)[number]

const secretName = (userId: string, provider: CredProvider) => `cred:${userId}:${provider}`

/**
 * Attempts to write a provider payload into Supabase Vault (encrypted at rest).
 * Returns the new vault secret id, or null if Vault isn't available.
 */
async function tryCreateVaultSecret(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  provider: CredProvider,
  payload: Record<string, string>,
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("create_secret", {
      secret: JSON.stringify(payload),
      name: secretName(userId, provider),
    })
    if (!error && data) return String(data)
  } catch {
    // Vault not configured — fall back to legacy plaintext column.
  }
  return null
}

/** Reads a payload either from Vault or (legacy) the plaintext payload column. */
async function readPayload(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  vaultSecretId: string | null,
  legacyPayload: Record<string, string> | null,
): Promise<Record<string, string> | null> {
  if (vaultSecretId) {
    try {
      // PostgREST only serves the `public` schema, so reads go through the
      // SECURITY DEFINER wrapper from 0007_vault_wrappers.sql (server-only,
      // service_role key — never exposed to the anon key).
      const { data, error } = await supabase.rpc("read_secret", {
        secret_id: vaultSecretId,
      })
      if (!error && data) {
        const parsed = JSON.parse(data as string)
        if (parsed && typeof parsed === "object") return parsed as Record<string, string>
      }
    } catch {
      // fall through to legacy
    }
  }
  return legacyPayload
}

export async function getCredentials(userId: string, provider: CredProvider) {
  const supabase = createAdminClient()
  if (!supabase) return null
  const { data } = await supabase
    .from("integration_credentials")
    .select("vault_secret_id, payload")
    .eq("user_id", userId)
    .eq("provider", provider)
    .single()
  if (!data) return null
  const legacy = (data.payload ?? null) as Record<string, string> | null
  return readPayload(supabase, data.vault_secret_id as string | null, legacy)
}

export async function setCredentials(
  userId: string,
  provider: CredProvider,
  payload: Record<string, string>,
) {
  const supabase = createAdminClient()
  if (!supabase) return null

  const vaultSecretId = await tryCreateVaultSecret(supabase, userId, provider, payload)

  // If Vault worked, store its id and clear the plaintext copy.
  const { error } = await supabase.from("integration_credentials").upsert(
    {
      user_id: userId,
      provider,
      vault_secret_id: vaultSecretId ?? null,
      payload: vaultSecretId ? null : payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  )
  return error
}

export async function deleteCredentials(userId: string, provider: CredProvider) {
  const supabase = createAdminClient()
  if (!supabase) return
  await supabase
    .from("integration_credentials")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider)
}

export function getOAuthConfig(provider: CredProvider) {
  if (provider === "stripe") {
    return {
      clientId: process.env.STRIPE_CLIENT_ID ?? "",
      clientSecret: process.env.STRIPE_CLIENT_SECRET ?? "",
    }
  }
  if (provider === "xero") {
    return {
      clientId: process.env.XERO_CLIENT_ID ?? "",
      clientSecret: process.env.XERO_CLIENT_SECRET ?? "",
    }
  }
  return { clientId: "", clientSecret: "" }
}

export function isProviderConfigured(provider: CredProvider) {
  const cfg = getOAuthConfig(provider)
  return Boolean(cfg.clientId && cfg.clientSecret)
}
