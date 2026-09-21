"use client"

import { useEffect, useRef, useState } from "react"
import { Plug, X } from "lucide-react"
import type { IntegrationRow } from "@/types"
import { Button } from "@/components/ui/button"
import { IntegrationsManager } from "@/components/settings/integrations-manager"

export function ConnectSourcesDialog({
  rows,
  stripeConfigured,
  xeroConfigured,
  label = "Connect",
}: {
  rows: IntegrationRow[]
  stripeConfigured: boolean
  xeroConfigured: boolean
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    panelRef.current?.querySelector<HTMLElement>("button, a, input")?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", closeOnEscape)
    }
  }, [open])

  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Plug className="h-3.5 w-3.5" aria-hidden /> {label}
      </Button>
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/45 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(e) => {
          if (e.target === e.currentTarget) setOpen(false)
        }}>
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-sources-title"
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-hairline bg-paper p-4 shadow-2xl sm:max-w-3xl sm:rounded-xl sm:p-6"
          >
            <div className="sticky top-0 z-10 mb-4 flex items-start justify-between gap-3 bg-paper pb-3">
              <div>
                <h2 id="connect-sources-title" className="font-display text-2xl tracking-tight text-ink">Connect invoices</h2>
                <p className="mt-1 text-sm text-muted">Choose PayPal, Xero, or CSV. Imported invoices appear in the ledger automatically.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close invoice sources"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-hairline bg-surface text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <IntegrationsManager rows={rows} stripeConfigured={stripeConfigured} xeroConfigured={xeroConfigured} />
          </div>
        </div>
      ) : null}
    </>
  )
}
