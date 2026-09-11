import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { IntegrationsManager } from "@/components/settings/integrations-manager"
import { isProviderConfigured } from "@/lib/integrations/credentials"
import type { IntegrationRow } from "@/types"
import { ArrowLeft } from "lucide-react"

export const metadata = { title: "Invoice sources" }

export const dynamic = "force-dynamic"

export default async function IntegrationsPage({ searchParams }: { searchParams?: { upgrade?: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/?signin=1")

  const { data } = await supabase
    .from("integrations")
    .select("*")
    .eq("user_id", user.id)
  const rows = (data as IntegrationRow[]) ?? []

  const pendingUpgrade = searchParams?.upgrade === "1"

  return (
    <div className="space-y-5">
      {pendingUpgrade ? (
        <div className="rounded-md border border-ember/40 bg-ember/10 p-4 text-sm text-ink-soft">
          Automated sync from Stripe, PayPal and Xero is a Pro feature.{" "}
          <Link href="/settings/billing" className="font-medium text-ink underline underline-offset-2">
            Upgrade to Pro
          </Link>{" "}
          to connect invoicing sources.
        </div>
      ) : null}

      <Link href="/settings" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Settings
      </Link>
      <header>
        <h1 className="font-display text-3xl tracking-tight text-ink">Invoice sources</h1>
        <p className="mt-1 text-sm text-muted">
          One ledger for every place you bill. Syncs on connect and on demand.
        </p>
      </header>

      <IntegrationsManager
        rows={rows ?? []}
        stripeConfigured={isProviderConfigured("stripe")}
        paypalConfigured={isProviderConfigured("paypal")}
        xeroConfigured={isProviderConfigured("xero")}
      />
    </div>
  )
}