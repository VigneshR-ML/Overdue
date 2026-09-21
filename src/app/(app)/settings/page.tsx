import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth/session"
import { getProfile } from "@/lib/db/queries"
import { Card, CardHeader, CardBody } from "@/components/ui/card"
import { AccountDataControls } from "@/components/settings/account-data-controls"
import { PageHeader } from "@/components/app-shell/page-header"
import { SenderNameForm } from "@/components/settings/sender-name-form"

export const metadata = { title: "Settings" }

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const session = await getSessionUser()
  if (!session) redirect("/?signin=1")
  const profile = await getProfile(session.id)

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Workspace"
        title="Settings"
        description="Your account, your integrations, your billing."
      />

      <div className="grid gap-4 md:grid-cols-3">
<Card className="h-full">
          <CardHeader><span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Account</span></CardHeader>
          <CardBody className="space-y-3">
            <div>
              <div className="text-[13px] text-muted">Email</div>
              <div className="font-mono text-[14px] text-ink">{session.email}</div>
            </div>
            <SenderNameForm initialName={profile?.full_name ?? session.email.split("@")[0] ?? ""} />
          </CardBody>
        </Card>

        <Link href="/settings/integrations" className="group">
          <Card className="h-full transition-all duration-150 group-hover:-translate-y-0.5 group-hover:border-ink-soft">
            <CardHeader>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Invoice sources</span>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-sm text-muted">PayPal · Xero · CSV. Every source shows up in one ledger.</p>
              <span className="font-mono text-[12px] text-moss">Configure →</span>
            </CardBody>
          </Card>
        </Link>

        <Link href="/settings/billing" className="group">
          <Card className="h-full transition-all duration-150 group-hover:-translate-y-0.5 group-hover:border-ink-soft">
            <CardHeader>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Billing</span>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-sm text-muted">Free or Pro. Your plan, your payment history — via Paddle.</p>
              <span className="font-mono text-[12px] text-moss">Manage →</span>
            </CardBody>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader><span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Your data</span></CardHeader>
        <CardBody>
          <AccountDataControls />
        </CardBody>
      </Card>
    </div>
  )
}