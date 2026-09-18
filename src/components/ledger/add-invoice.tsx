"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import { Plus } from "lucide-react"
import { CURRENCIES } from "@/lib/onboarding/schedule"

export interface ClientOption {
  id: string
  name: string
  billing_email: string | null
}

export function AddInvoiceButton({ clients = [] }: { clients?: ClientOption[] }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const [clientName, setClientName] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [clientPick, setClientPick] = useState("")
  const [number, setNumber] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [dueDate, setDueDate] = useState("")
  const [paymentUrl, setPaymentUrl] = useState("")
  const [noEmailDraft, setNoEmailDraft] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function pickClient(id: string) {
    setClientPick(id)
    const client = clients.find((c) => c.id === id)
    if (client) {
      setClientName(client.name)
      setClientEmail(client.billing_email ?? "")
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    // (UX-07) Duplicate-submission guard: a double-click can't post twice.
    if (saving) return
    const cents = Math.round(parseFloat(amount) * 100)
    if (!clientName.trim()) {
      setError("Client name is required.")
      return
    }
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Enter a valid amount greater than zero.")
      return
    }
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      setError("Choose a valid due date.")
      return
    }
    if (!clientEmail.trim() && !noEmailDraft) {
      setError("Add a client email so reminders can be sent — or tick “save without email” to keep this as a draft.")
      return
    }
    if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      setError("That email address doesn't look right.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: clientName.trim(),
          client_email: clientEmail.trim() || undefined,
          number: number.trim() || undefined,
          amount_cents: cents,
          currency,
          due_date: dueDate || undefined,
          payment_url: paymentUrl.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error ?? "Couldn't add invoice")
        return
      }
      setOpen(false)
      setClientName(""); setClientEmail(""); setClientPick(""); setNumber(""); setAmount(""); setDueDate(""); setPaymentUrl(""); setNoEmailDraft(false)
      // (UX-07) Open the new invoice so the owner sees its detail and the real
      // next action instead of getting lost in a long table.
      router.push(`/invoices/${json.id as string}`)
    } catch {
      setError("Network error — try again")
    } finally {
      setSaving(false)
    }
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
      <div className="flex items-center justify-between">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Manual invoice</div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Close</Button>
      </div>

      {clients.length > 0 ? (
        <Field label="Existing client">
          <select
            value={clientPick}
            onChange={(e) => pickClient(e.target.value)}
            className="h-10 w-full rounded-md border border-hairline bg-paper px-3 font-mono text-[13px] text-ink focus:border-ink-soft focus:outline-none"
          >
            <option value="">+ New client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.billing_email ? ` · ${c.billing_email}` : ""}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

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
        <Field label={`Amount (${currency})`}>
          <Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1200.00" required />
        </Field>
        <Field label="Currency">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="h-10 w-full rounded-md border border-hairline bg-paper px-3 font-mono text-[13px] text-ink focus:border-ink-soft focus:outline-none"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Due date">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Payment link (optional)">
            <Input type="url" value={paymentUrl} onChange={(e) => setPaymentUrl(e.target.value)} placeholder="https://…pay this invoice" />
          </Field>
        </div>
      </div>

      {!clientEmail ? (
        <label className="flex items-start gap-2 text-[13px] text-muted">
          <input type="checkbox" checked={noEmailDraft} onChange={(e) => setNoEmailDraft(e.target.checked)} className="mt-1" />
          Save without an email — this invoice stays a draft and reminders can&apos;t be sent until a client email is added.
        </label>
      ) : null}

      {error ? <p className="font-mono text-[12px] text-crimson">{error}</p> : null}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}>{saving ? "Adding…" : "Add invoice"}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  )
}