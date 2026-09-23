"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/utils/format"

type Request = { id: string; requested_cents: number | null; message: string; status: string; created_at: string }

function copyFor(status: string) {
  switch (status) {
    case "open": return { title: "Payment plan requested", body: "The client asked to arrange payment. Review the request before the recovery ladder continues." }
    case "accepted": return { title: "Payment proposal prepared", body: "A proposal is being arranged. The recovery ladder remains paused until the client accepts, declines, or the proposal expires." }
    case "converted": return { title: "Payment plan active", body: "The client accepted the payment plan. The recovery ladder is paused while scheduled installments are active." }
    case "declined": return { title: "Payment plan declined", body: "The request was declined. The recovery ladder can resume after its configured pause." }
    case "expired": return { title: "Payment plan request expired", body: "No agreement was reached before the review window ended. The recovery ladder can continue." }
    case "closed": return { title: "Payment plan closed", body: "This request is closed. Check the timeline and payment schedule for the recorded outcome." }
    default: return { title: "Payment plan update", body: "Check the timeline for the recorded payment-plan outcome." }
  }
}

export function PaymentPlanRequest({ request, currency, onChanged }: { request: Request; currency: string; onChanged?: () => void }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function decide(status: "accepted" | "declined") {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/payment-plans/${request.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Couldn't update payment plan")
      onChanged?.()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update payment plan")
    } finally {
      setBusy(false)
    }
  }
  const isOpen = request.status === "open"
  const copy = copyFor(request.status)
  return <section className="rounded-lg border border-ember/35 bg-ember/10 p-4"><h3 className="font-display text-lg text-ink">{copy.title}</h3><p className="mt-1 text-sm leading-relaxed text-muted">{copy.body}</p>{request.requested_cents ? <p className="mt-2 font-mono text-[12px] text-ink">Requested amount: {formatMoney(request.requested_cents, currency)}</p> : null}{request.message ? <p className="mt-2 border-l-2 border-ember/40 pl-3 text-sm text-ink-soft">{request.message}</p> : null}{isOpen ? <div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="moss" disabled={busy} onClick={() => decide("accepted")}>Prepare proposal</Button><Button type="button" variant="outline" disabled={busy} onClick={() => decide("declined")}>Decline & resume reminders</Button></div> : null}{error ? <p className="mt-2 text-xs text-crimson">{error}</p> : null}</section>
}
