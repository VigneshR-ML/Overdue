"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { formatRelative } from "@/lib/utils/format"
import type { IntegrationRow } from "@/types"
import { Button } from "@/components/ui/button"
import { Badge, StatusDot } from "@/components/ui/badge"
import { RefreshCw, Unplug, Upload } from "lucide-react"

type ProviderName = "stripe" | "paypal" | "xero" | "csv"

const PROVIDER_META: Record<ProviderName, { label: string; blurb: string }> = {
  stripe: { label: "Stripe", blurb: "Auto-sync unpaid invoices + late payments" },
  paypal: { label: "PayPal", blurb: "Sync invoices via the Invoicing API" },
  xero: { label: "Xero", blurb: "Sync receivables via OAuth2" },
  csv: { label: "CSV import", blurb: "Drop a spreadsheet of anything" },
}

export function IntegrationsManager({
  rows,
  paypalConfigured,
  stripeConfigured,
  xeroConfigured,
}: {
  rows: IntegrationRow[]
  paypalConfigured: boolean
  stripeConfigured: boolean
  xeroConfigured: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)

  const connected = (p: string) => rows.some((r) => r.provider === p && r.status !== "error")
  const rowFor = (p: string) => rows.find((r) => r.provider === p)

  async function runSync(provider: string) {
    setBusy(provider)
    setNotice(null)
    const res = await fetch(`/api/integrations/${provider}/sync`, { method: "POST" })
    const json = await res.json()
    setBusy(null)
    if (!res.ok) return setNotice(`Sync failed: ${json?.error ?? "try again"}`)
    const r = json.result ?? {}
    setNotice(`${provider}: ${r.added ?? 0} added, ${r.updated ?? 0} updated.`)
    router.refresh()
  }

  async function disconnect(provider: string) {
    setBusy(provider)
    await fetch(`/api/integrations/${provider}/disconnect`, { method: "DELETE" })
    setBusy(null)
    router.refresh()
  }

  async function importCsv() {
    if (!csvFile) return
    setBusy("csv")
    setCsvError(null)
    const text = await csvFile.text()
    const res = await fetch("/api/integrations/csv", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: text,
    })
    const json = await res.json()
    setBusy(null)
    if (!res.ok) return setCsvError(json?.error ?? "CSV import failed")
    setCsvFile(null)
    setNotice(`CSV: ${json.result?.added ?? 0} invoices imported.`)
    router.refresh()
  }

  const providers: (ProviderName & keyof typeof PROVIDER_META)[] = ["stripe", "paypal", "xero", "csv"]

  return (
    <div className="space-y-4">
      {notice ? (
        <div className="rounded-md border border-moss/40 bg-moss-soft p-3 font-mono text-[13px] text-moss">{notice}</div>
      ) : null}

      {providers.map((p) => {
        const meta = PROVIDER_META[p]
        const isConnected = connected(p)
        const row = rowFor(p)
        const configured = p === "stripe" ? stripeConfigured : p === "paypal" ? paypalConfigured : p === "xero" ? xeroConfigured : true

        return (
          <div key={p} className="rounded-lg border border-hairline bg-surface p-5 shadow-ledger">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ProviderMark p={p} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg text-ink">{meta.label}</span>
                    {isConnected ? (
                      <Badge className="border-moss/30 bg-moss-soft text-moss"><StatusDot color="#2F5D50" /> connected</Badge>
                    ) : null}
                  </div>
                  <div className="text-[13px] text-muted">{meta.blurb}</div>
                  {row?.last_synced_at ? (
                    <div className="font-mono text-[11px] text-faint">last sync {formatRelative(row.last_synced_at)}</div>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isConnected && p !== "csv" ? (
                  <>
                    <Button variant="outline" size="sm" disabled={busy === p} onClick={() => runSync(p)} className="gap-2">
                      <RefreshCw className={`h-3.5 w-3.5 ${busy === p ? "animate-spin" : ""}`} /> Sync
                    </Button>
                    <Button variant="ghost" size="sm" disabled={busy === p} onClick={() => disconnect(p)} className="gap-2 text-rust">
                      <Unplug className="h-3.5 w-3.5" /> Disconnect
                    </Button>
                  </>
                ) : (
                  <>
                    {!configured ? (
                      <span className="max-w-[220px] text-right font-mono text-[11px] leading-relaxed text-ember">
                        add {p.toUpperCase()}_CLIENT_ID / _CLIENT_SECRET to .env to enable OAuth
                      </span>
                    ) : p === "paypal" ? (
                      <PaypalCredsForm onDone={() => router.refresh()} />
                    ) : p !== "csv" ? (
                      <a href={`/api/integrations/${p}/start`}>
                        <Button size="sm" variant="ink">Connect {meta.label}</Button>
                      </a>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            {p === "csv" && (
              <label className="mt-4 flex items-center justify-between gap-3 rounded-md border border-dashed border-hairline p-3">
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Upload className="h-4 w-4 text-faint" />
                  {csvFile ? <span className="font-mono text-[13px] text-ink">{csvFile.name}</span> : "client_name, client_email, number, amount, currency, due_date…"}
                </div>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                />
                <Button type="button" size="sm" variant={csvFile ? "ink" : "outline"} disabled={!csvFile || busy === "csv"} onClick={importCsv}>
                  Import
                </Button>
              </label>
            )}
            {csvError ? <p className="mt-2 font-mono text-[12px] text-crimson">{csvError}</p> : null}
          </div>
        )
      })}

      <p className="font-mono text-[11px] leading-relaxed text-faint">
        Credentials are stored encrypted-side server-only, used only to fetch your invoices.
        OAuth tokens refresh automatically where supported; CSVs never leave your session on import.
      </p>
    </div>
  )
}

function ProviderMark({ p }: { p: string }) {
  const initials = p === "stripe" ? "S" : p === "paypal" ? "P" : p === "xero" ? "X" : "CSV"
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-hairline bg-paper font-mono text-[11px] font-medium text-ink-soft">
      {initials}
    </span>
  )
}

function PaypalCredsForm({ onDone }: { onDone: () => void }) {
  const [editing, setEditing] = useState(false)
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [mode, setMode] = useState<"sandbox" | "live">("sandbox")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (!editing) {
    return (
      <Button size="sm" variant="ink" onClick={() => setEditing(true)}>
        Connect PayPal
      </Button>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId || !clientSecret) return setError("Both client ID and secret are required.")
    setSaving(true)
    setError(null)
    const res = await fetch("/api/integrations/paypal/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, clientSecret, mode }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) return setError(json?.error ?? "Couldn't save credentials.")
    onDone()
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <span className="text-[11px] font-medium text-ink-soft">Client ID</span>
        <input
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="h-8 w-44 rounded-md border border-hairline bg-surface px-2 font-mono text-[12px] focus:border-ink-soft focus:outline-none"
          placeholder="AT...xxxx"
        />
      </div>
      <div className="space-y-1">
        <span className="text-[11px] font-medium text-ink-soft">Secret</span>
        <input
          type="password"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          className="h-8 w-44 rounded-md border border-hairline bg-surface px-2 font-mono text-[12px] focus:border-ink-soft focus:outline-none"
          placeholder="••••••••"
        />
      </div>
      <div className="space-y-1">
        <span className="text-[11px] font-medium text-ink-soft">Mode</span>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "sandbox" | "live")}
          className="h-8 rounded-md border border-hairline bg-surface px-2 font-mono text-[12px]"
        >
          <option value="sandbox">sandbox</option>
          <option value="live">live</option>
        </select>
      </div>
      <Button type="submit" size="sm" disabled={saving}>{saving ? "Saving…" : "Save & sync"}</Button>
      {error ? <span className="font-mono text-[11px] text-crimson">{error}</span> : null}
    </form>
  )
}