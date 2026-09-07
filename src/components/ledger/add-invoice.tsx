"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { isDemoMode } from "@/lib/demo/fixtures"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import { Plus } from "lucide-react"

export function AddInvoiceButton() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const [clientName, setClientName] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [number, setNumber] = useState("")
  const [amount, setAmount] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const cents = Math.round(parseFloat(amount) * 100)
    if (isDemoMode()) {
      setSaving(false)
      setOpen(false)
      setClientName(""); setClientEmail(""); setNumber(""); setAmount(""); setDueDate("")
      return
    }
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: clientName,
        client_email: clientEmail,
        number,
        amount_cents: cents,
        currency: "USD",
        due_date: dueDate,
      }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) return setError(json?.error ?? "Couldn't add invoice")
    setOpen(false)
    setClientName(""); setClientEmail(""); setNumber(""); setAmount(""); setDueDate("")
    router.refresh()
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Add invoice
      </Button>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-hairline bg-surface p-5 shadow-ledger space-y-4">
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Manual invoice</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client name">
          <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Northwind Creative" required />
        </Field>
        <Field label="Client email">
          <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="billing@northwind.com" />
        </Field>
        <Field label="Invoice number">
          <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="2026-0952" />
        </Field>
        <Field label="Amount (USD)">
          <Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1200.00" required />
        </Field>
        <Field label="Due date">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </Field>
      </div>
      {error ? <p className="font-mono text-[12px] text-crimson">{error}</p> : null}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}>{saving ? "Adding…" : "Add to ledger"}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  )
}