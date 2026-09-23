"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import type { IntegrationRow } from "@/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Upload } from "lucide-react"

type ProviderName = "stripe" | "paypal" | "quickbooks" | "xero"

const PROVIDER_META: Record<ProviderName, { label: string; blurb: string }> = {
  stripe: { label: "Stripe", blurb: "Automatic invoice sync is in development." },
  paypal: { label: "PayPal", blurb: "Automatic invoice sync is in development." },
  quickbooks: { label: "QuickBooks", blurb: "Automatic invoice sync is in development." },
  xero: { label: "Xero", blurb: "Automatic invoice sync is in development." },
}

export function IntegrationsManager({
  rows: _rows,
  stripeConfigured: _stripeConfigured,
  xeroConfigured: _xeroConfigured,
}: {
  rows: IntegrationRow[]
  stripeConfigured: boolean
  xeroConfigured: boolean
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)

  async function importCsv() {
    if (!csvFile) return
    try {
      const text = await csvFile.text()
      const res = await fetch("/api/integrations/csv", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: text,
      })
      const json = await res.json()
      if (!res.ok) return setNotice(json?.error ?? "CSV import failed")
      setCsvFile(null)
      setNotice(`CSV: ${json.result?.added ?? 0} invoices imported.`)
      router.refresh()
    } catch { setNotice("Network error — try again") }
  }

  return (
    <div className="space-y-4">
      {notice ? (
        <div className="rounded-md border border-moss/40 bg-moss-soft p-3 font-mono text-[13px] text-moss">{notice}</div>
      ) : null}

      <div className="rounded-lg border border-moss/35 bg-moss-soft/35 p-4 text-sm text-moss">
        <span className="font-medium">Use CSV for now.</span> The importer understands exports from PayPal, Stripe, QuickBooks and Xero. Direct account connections will return after their secure self-connect flows are ready.
      </div>

      {(Object.keys(PROVIDER_META) as ProviderName[]).map((p) => {
        const meta = PROVIDER_META[p]

        return (
          <div key={p} className="rounded-lg border border-hairline bg-surface p-5 shadow-ledger">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ProviderMark p={p} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg text-ink">{meta.label}</span>
                    <Badge className="border-hairline bg-paper text-muted">Coming soon</Badge>
                  </div>
                  <div className="text-[13px] text-muted">{meta.blurb}</div>
                </div>
              </div>
            </div>
          </div>
        )
      })}

      <div className="rounded-lg border border-hairline bg-surface p-5 shadow-ledger">
        <Link href="/tools/smart-csv" className="block rounded-md border border-moss/40 bg-moss-soft/40 p-3 text-[13px] text-moss hover:bg-moss-soft">
          <span className="font-medium">Smart CSV import →</span> maps platform-specific headers before anything enters your ledger.
        </Link>
        <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-dashed border-hairline p-3">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Upload className="h-4 w-4 text-faint" />
            {csvFile ? <span className="font-mono text-[13px] text-ink">{csvFile.name}</span> : "Upload a PayPal, Stripe, QuickBooks or Xero CSV"}
          </div>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => {
            setCsvFile(e.target.files?.[0] ?? null)
            e.currentTarget.value = ""
          }} />
          {csvFile ? (
            <Button type="button" size="sm" variant="ink" onClick={importCsv}>Import CSV</Button>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>Choose CSV</Button>
          )}
        </div>
      </div>

      <p className="font-mono text-[11px] leading-relaxed text-faint">
        CSV files are mapped in your browser. Only headers and up to three sample rows are sent to AI for mapping; you can review every mapping before importing.
      </p>
    </div>
  )
}

function ProviderMark({ p }: { p: string }) {
  const initials = p === "stripe" ? "S" : p === "paypal" ? "P" : p === "xero" ? "X" : p === "quickbooks" ? "QB" : "CSV"
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-hairline bg-paper font-mono text-[11px] font-medium text-ink-soft">
      {initials}
    </span>
  )
}
