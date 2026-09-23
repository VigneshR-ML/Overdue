"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function AttachLadderButton({ invoiceId, sequenceId }: { invoiceId: string; sequenceId: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)
  async function attach() { setBusy(true); setError(null); try { const res = await fetch(`/api/invoices/${invoiceId}/sequence`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sequenceId, replace: true }) }); const json = await res.json(); if (!res.ok) throw new Error(json?.error || "Couldn't attach ladder"); router.push(`/invoices/${invoiceId}?ladder=attached`) } catch (e) { setError(e instanceof Error ? e.message : "Couldn't attach ladder") } finally { setBusy(false) } }
  return <div className="mt-3"><Button type="button" onClick={attach} disabled={busy} variant="moss">{busy ? "Attaching…" : "Use for this invoice"}</Button>{error ? <p className="mt-2 text-xs text-crimson">{error}</p> : null}</div>
}
