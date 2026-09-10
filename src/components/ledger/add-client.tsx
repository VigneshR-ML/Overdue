"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function AddClientButton({ onAdded }: { onAdded?: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function close() {
    setOpen(false)
    setError(null)
  }

  React.useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      })
      const json = await res.json()
      if (!json.ok) {
        setError(json.error ?? "Failed to add client")
        return
      }
      setName("")
      setEmail("")
      setOpen(false)
      onAdded?.()
    } catch {
      setError("Network error — try again")
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Add client
      </Button>
    )
  }

  return (
    <>
      <Button variant="outline" size="sm" disabled>
        Add client
      </Button>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm" onClick={close}>
        <form
          onSubmit={handleSubmit}
          role="dialog"
          aria-modal="true"
          aria-label="Add a client"
          className="w-full max-w-sm rounded-lg border border-hairline bg-surface p-6 shadow-lg space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <div className="font-display text-lg text-ink">Add a client</div>
            <p className="mt-1 text-[13px] text-muted">
              Clients are also created automatically when invoices sync from Stripe, PayPal or Xero.
            </p>
          </div>

          <div className="space-y-3">
            <Input
              placeholder="Client name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
            <Input
              type="email"
              placeholder="Billing email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && <p className="text-[13px] text-ember" role="alert">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="moss" size="sm" disabled={loading || !name.trim()}>
              {loading ? "Adding…" : "Add client"}
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
