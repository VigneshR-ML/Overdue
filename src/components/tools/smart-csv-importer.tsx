"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  CANONICAL_FIELDS,
  applyMapping,
  computeStats,
  splitCsvRows,
  toNormalizedCsv,
  truncateCell,
  type ColumnMapping,
  type NormalizedRow,
  type SmartCsvStats,
} from "@/lib/csv/smart-csv"

interface Insights {
  summary: string
  risks: string[]
  nextActions: string[]
  aiUsed: boolean
}

const FIELD_HINT: Record<string, string> = {
  client_name: "who owes",
  client_email: "email",
  number: "invoice id",
  amount: "money owed",
  currency: "USD/EUR/…",
  issue_date: "issued",
  due_date: "payment due",
  status: "paid/open",
  payment_url: "pay link",
}

export function SmartCsvImporter() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [confidence, setConfidence] = useState<number | null>(null)
  const [aiUsed, setAiUsed] = useState<boolean | null>(null)
  const [mapNote, setMapNote] = useState<string | null>(null)
  const [busy, setBusy] = useState<"map" | "insights" | "import" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [imported, setImported] = useState<number | null>(null)

  const normalized: NormalizedRow[] = useMemo(
    () => (headers.length && rows.length ? applyMapping(headers, rows, mapping) : []),
    [headers, rows, mapping],
  )
  const stats: SmartCsvStats | null = useMemo(
    () => (normalized.length ? computeStats(normalized) : null),
    [normalized],
  )

  async function handleFile(file: File) {
    setError(null)
    setInsights(null)
    setImported(null)
    setConfidence(null)
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large (max 10 MB).")
      return
    }
    const text = await file.text()
    const parsed = splitCsvRows(text)
    if (parsed.length < 2) {
      setError("Couldn't find a header row + data rows in that file.")
      return
    }
    const [hdr, ...data] = parsed
    setFileName(file.name)
    setHeaders(hdr.map((h) => h.trim()))
    setRows(data)
    setMapping({})
    // Auto-map with the LLM (headers + 3 sample rows only — full file stays local).
    await requestMapping(hdr.map((h) => h.trim()), data)
  }

  async function requestMapping(hdrs: string[], data: string[][]) {
    setBusy("map")
    setMapNote(null)
    try {
      const res = await fetch("/api/tools/smart-csv/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headers: hdrs,
          samples: data.slice(0, 3),
          totalRows: data.length,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error ?? "mapping failed")
      setMapping(json.mapping ?? {})
      setConfidence(typeof json.confidence === "number" ? json.confidence : null)
      setAiUsed(Boolean(json.aiUsed))
      setMapNote(json.notes ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI mapping failed — map columns manually below.")
    } finally {
      setBusy(null)
    }
  }

  async function requestInsights() {
    if (!stats) return
    setBusy("insights")
    setError(null)
    try {
      const unmapped = CANONICAL_FIELDS.filter((f) => mapping[f] === undefined)
      const res = await fetch("/api/tools/smart-csv/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stats: {
            totalRows: stats.totalRows,
            validRows: stats.validRows,
            skippedRows: stats.skippedRows,
            totalCents: stats.totalCents,
            currency: stats.currency,
            overdueCount: stats.overdueCount,
            overdueCents: stats.overdueCents,
            dueSoonCount: stats.dueSoonCount,
            dueSoonCents: stats.dueSoonCents,
            oldestDue: stats.oldestDue,
            topDebtors: stats.topDebtors,
          },
          confidence: confidence ?? 0.5,
          unmapped,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error ?? "insights failed")
      setInsights({ summary: json.summary, risks: json.risks ?? [], nextActions: json.nextActions ?? [], aiUsed: Boolean(json.aiUsed) })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate insights.")
    } finally {
      setBusy(null)
    }
  }

  async function importToLedger() {
    if (!normalized.length) return
    setBusy("import")
    setError(null)
    try {
      const csv = toNormalizedCsv(normalized)
      if (!csv.split("\n").length || normalized.filter((r) => r._valid).length === 0) {
        throw new Error("Nothing valid to import — check the amount column mapping.")
      }
      const res = await fetch("/api/integrations/csv", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: csv,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "import failed")
      setImported(json.result?.added ?? 0)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.")
    } finally {
      setBusy(null)
    }
  }

  const setField = (field: (typeof CANONICAL_FIELDS)[number], value: string) => {
    setInsights(null)
    setImported(null)
    setMapping((m) => {
      const next = { ...m }
      if (value === "-1") delete next[field]
      else next[field] = Number(value)
      return next
    })
  }

  return (
    <div className="space-y-5">
      {/* Upload */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-hairline bg-surface p-4">
        <div className="text-sm text-muted">
          {fileName ? (
            <span className="font-mono text-[13px] text-ink">{fileName}</span>
          ) : (
            "Drop any invoice CSV — messy headers welcome (Client, Inv No, Total Due, …)"
          )}
          <div className="mt-1 font-mono text-[11px] text-faint">
            understands PayPal, Stripe, QuickBooks and Xero exports · only headers + 3 sample rows go to AI
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.currentTarget.value = ""
          }}
        />
        <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
          {fileName ? "Replace" : "Upload CSV"}
        </Button>
      </div>

      {error ? (
        <div role="alert" className="rounded-md border border-rust/40 bg-rust/10 p-3 text-[13px] text-crimson">
          {error}
        </div>
      ) : null}

      {headers.length > 0 ? (
        <>
          {/* Mapping */}
          <section className="rounded-lg border border-hairline bg-surface p-5 shadow-ledger">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg text-ink">1 · AI column mapping</h2>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
                {busy === "map"
                  ? "asking AI…"
                  : confidence !== null
                    ? `${Math.round(confidence * 100)}% confident${aiUsed === false ? " · heuristic" : " · AI"}`
                    : ""}
              </span>
            </div>
            {mapNote ? <p className="mt-1 text-[13px] text-muted">{mapNote}</p> : null}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {CANONICAL_FIELDS.map((field) => (
                <label key={field} className="block">
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                    {field} <span className="text-faint">· {FIELD_HINT[field]}</span>
                  </span>
                  <select
                    value={mapping[field] ?? "-1"}
                    onChange={(e) => setField(field, e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-hairline bg-paper px-2 font-mono text-[12px] text-ink focus:border-ink-soft focus:outline-none"
                  >
                    <option value="-1">— ignore —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={String(i)}>
                        {i}: {truncateCell(h || "(empty)", 32) || `(col ${i})`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy === "map"}
                onClick={() => requestMapping(headers, rows)}
              >
                Re-run AI mapping
              </Button>
            </div>
          </section>

          {/* Stats + insights */}
          {stats ? (
            <section className="rounded-lg border border-hairline bg-surface p-5 shadow-ledger">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg text-ink">2 · What the AI sees</h2>
                <Button type="button" size="sm" variant="moss" disabled={busy === "insights"} onClick={requestInsights}>
                  {busy === "insights" ? "Analyzing…" : insights ? "Re-analyze" : "Analyze with AI"}
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  [`${stats.validRows}/${stats.totalRows}`, "rows valid"],
                  [`${(stats.totalCents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })} ${stats.currency}`, "total"],
                  [`${stats.overdueCount} · ${(stats.overdueCents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`, "overdue"],
                  [`${stats.dueSoonCount} · ${(stats.dueSoonCents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`, "due in 7d"],
                ].map(([v, l]) => (
                  <div key={l} className="rounded-md border border-hairline bg-paper p-3">
                    <div className="font-display text-lg text-ink">{v}</div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{l}</div>
                  </div>
                ))}
              </div>
              {stats.topDebtors.length > 0 ? (
                <ul className="mt-3 space-y-1 text-[13px] text-muted">
                  {stats.topDebtors.map((d) => (
                    <li key={d.name} className="flex justify-between gap-2">
                      <span className="truncate">{d.name} <span className="font-mono text-[11px] text-faint">×{d.count}</span></span>
                      <span className="font-mono">{(d.cents / 100).toLocaleString("en-US")} {stats.currency}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {stats.skippedRows > 0 ? (
                <p className="mt-2 font-mono text-[11px] text-ember">
                  {stats.skippedRows} row{stats.skippedRows === 1 ? "" : "s"} skipped (missing/invalid amount) — check mapping.
                </p>
              ) : null}

              {insights ? (
                <div className="mt-4 rounded-md border border-moss/30 bg-moss-soft/40 p-4">
                  <p className="text-sm leading-relaxed text-ink">{insights.summary}</p>
                  {insights.risks.length > 0 ? (
                    <div className="mt-3">
                      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ember">Risks</div>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-ink-soft">
                        {insights.risks.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {insights.nextActions.length > 0 ? (
                    <div className="mt-3">
                      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-moss">Next actions</div>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] text-ink-soft">
                        {insights.nextActions.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {!insights.aiUsed ? (
                    <p className="mt-2 font-mono text-[11px] text-faint">heuristic summary (AI unavailable)</p>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {/* Preview + import */}
          <section className="rounded-lg border border-hairline bg-surface p-5 shadow-ledger">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg text-ink">3 · Preview & import</h2>
              <Button type="button" size="sm" variant="ink" disabled={busy === "import" || !stats || stats.validRows === 0} onClick={importToLedger}>
                {busy === "import" ? "Importing…" : `Import ${stats?.validRows ?? 0} to ledger`}
              </Button>
            </div>
            {imported !== null ? (
              <p className="mt-2 rounded-md border border-moss/40 bg-moss-soft p-3 font-mono text-[13px] text-moss">
                {imported} invoices imported. <Link href="/invoices" className="underline">Open ledger →</Link>
              </p>
            ) : null}
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left font-mono text-[12px]">
                <thead>
                  <tr className="text-faint">
                    <th className="pb-2 pr-3 font-medium">client</th>
                    <th className="pb-2 pr-3 font-medium">number</th>
                    <th className="pb-2 pr-3 font-medium">amount</th>
                    <th className="pb-2 pr-3 font-medium">due</th>
                    <th className="pb-2 font-medium">status</th>
                  </tr>
                </thead>
                <tbody>
                  {normalized.slice(0, 8).map((r, i) => (
                    <tr key={i} className={`border-t border-hairline ${r._valid ? "text-ink-soft" : "text-crimson"}`}>
                      <td className="py-1.5 pr-3">{truncateCell(r.client_name ?? r.client_email ?? "—", 24)}</td>
                      <td className="py-1.5 pr-3">{truncateCell(r.number ?? "—", 16)}</td>
                      <td className="py-1.5 pr-3">{r.amount_cents !== null ? `${(r.amount_cents / 100).toLocaleString("en-US")} ${r.currency}` : r._error ?? "—"}</td>
                      <td className="py-1.5 pr-3">{r.due_date ?? "—"}</td>
                      <td className="py-1.5">{r._valid ? r.status : r._error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
