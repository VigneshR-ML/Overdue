"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"

export function AccountDataControls() {
  const [exporting, setExporting] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function handleExport() {
    setExporting(true)
    setError(null)
    try {
      const res = await fetch("/api/account/export", { method: "GET" })
      const json = await res.json()
      if (!json.ok) {
        setError(json.error ?? "Export failed")
        return
      }
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `overdue-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMessage("Export downloaded.")
    } catch {
      setError("Network error — try again")
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" })
      const json = await res.json()
      if (!json.ok) {
        setError(json.error ?? "Delete failed")
        setDeleting(false)
        return
      }
      window.location.href = "/?signin=1"
    } catch {
      setError("Network error — try again")
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-ink">Export your data</div>
          <p className="text-[13px] text-muted mt-0.5">
            Download a JSON copy of all invoices, clients, sequences and messages.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
          {exporting ? "Exporting…" : "Export"}
        </Button>
      </div>

      <div className="h-px bg-hairline" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-ink">Delete account</div>
          <p className="text-[13px] text-muted mt-0.5">
            Permanently removes your account and all associated data within 30 days.
          </p>
        </div>
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setConfirmDelete(false); setError(null) }}>
              Cancel
            </Button>
            <Button variant="ink" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete everything"}
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        )}
      </div>

      {message && <p className="text-[13px] text-moss">{message}</p>}
      {error && <p className="text-[13px] text-ember">{error}</p>}
    </div>
  )
}
