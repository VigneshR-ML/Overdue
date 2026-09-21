"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function SenderNameForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName)
  const [savedName, setSavedName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const senderName = name.trim()
    if (!senderName) return setMessage("Enter the name clients should see.")
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch("/api/account/sender", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderName }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return setMessage(json?.error ?? "Couldn't update the sender name.")
      setSavedName(senderName)
      setMessage("Sender name updated.")
    } catch {
      setMessage("Network error — try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-2">
      <label htmlFor="sender-name" className="text-[13px] text-muted">Sender name for reminder emails</label>
      <div className="flex gap-2">
        <Input
          id="sender-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          autoComplete="name"
          aria-describedby="sender-name-help"
        />
        <Button type="submit" size="sm" variant="outline" disabled={saving || name.trim() === savedName}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      <p id="sender-name-help" className="text-[12px] leading-relaxed text-faint">
        Used for the email signature and reply-to identity. The delivery address stays verified by Overdue.
      </p>
      {message ? <p className="font-mono text-[11px] text-moss" role="status">{message}</p> : null}
    </form>
  )
}
