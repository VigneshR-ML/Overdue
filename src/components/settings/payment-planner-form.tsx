"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function PaymentPlannerForm({ initialEnabled, initialBps }: { initialEnabled: boolean; initialBps: number }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [percent, setPercent] = useState(String(initialBps / 100))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMessage(null)
    const bps = Math.round(Number(percent) * 100)
    if (!Number.isFinite(bps) || bps < 0 || bps > 2000) { setSaving(false); return setMessage("Choose an incentive from 0% to 20%.") }
    try {
      const res = await fetch("/api/settings/payment-planner", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, maxIncentiveBps: bps }) })
      const data = await res.json().catch(() => ({}))
      setMessage(res.ok ? "Setting saved. It applies only to the legacy settlement planner, not installment schedules." : data.error ?? "Couldn't save settings.")
    } catch { setMessage("Network error — try again.") } finally { setSaving(false) }
  }
  return <form onSubmit={save} className="space-y-3"><label className="flex items-start gap-3 rounded-md border border-hairline bg-paper p-3"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="mt-1" /><span><span className="block text-sm font-medium text-ink">Legacy automatic-proposal setting</span><span className="mt-0.5 block text-[12px] leading-relaxed text-muted">Automatic discount proposals are disabled in the canonical workflow. Payment schedules are drafted from workspace policy and must be reviewed before they are sent.</span></span></label><label className="block text-[13px] text-muted">Maximum settlement incentive<div className="mt-1 flex max-w-xs items-center gap-2"><Input value={percent} inputMode="decimal" onChange={(e) => setPercent(e.target.value)} aria-label="Maximum incentive percentage" /><span className="text-sm text-ink">%</span></div></label><p className="text-[12px] leading-relaxed text-faint">The proposal never goes below the outstanding balance minus this percentage. Set 0% to propose the full outstanding amount.</p><Button type="submit" size="sm" variant="outline" disabled={saving}>{saving ? "Saving…" : "Save auto-plan settings"}</Button>{message ? <p className="font-mono text-[11px] text-moss" role="status">{message}</p> : null}</form>
}
