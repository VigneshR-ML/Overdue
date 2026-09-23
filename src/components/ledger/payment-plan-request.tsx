"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/utils/format"

export function PaymentPlanRequest({ request, currency }: { request: { id: string; requested_cents: number | null; message: string; status: string; created_at: string }; currency: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)
  async function decide(status: "accepted" | "declined") { setBusy(true); setError(null); try { const res = await fetch(`/api/payment-plans/${request.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.error || "Couldn't update payment plan"); router.refresh() } catch (e) { setError(e instanceof Error ? e.message : "Couldn't update payment plan") } finally { setBusy(false) } }
  const isOpen = request.status === "open"
  return <section className="rounded-lg border border-ember/40 bg-ember/10 p-4"><h2 className="font-display text-lg text-ink">Payment plan {isOpen ? "requested" : request.status}</h2><p className="mt-1 text-sm text-muted">{isOpen ? "The client asked to arrange payment. Reminders stay paused until you decide." : request.status === "accepted" ? "Approved. The client receives a confirmation when email delivery is configured; reminders remain paused while the schedule is arranged." : "This request was declined and the reminder workflow may continue."}</p>{request.requested_cents ? <p className="mt-2 font-mono text-[12px] text-ink">Requested amount: {formatMoney(request.requested_cents, currency)}</p> : null}{request.message ? <p className="mt-2 border-l-2 border-ember/40 pl-3 text-sm text-ink-soft">{request.message}</p> : null}{isOpen ? <div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="moss" disabled={busy} onClick={() => decide("accepted")}>Accept plan</Button><Button type="button" variant="outline" disabled={busy} onClick={() => decide("declined")}>Decline & resume reminders</Button></div> : null}{error ? <p className="mt-2 text-xs text-crimson">{error}</p> : null}</section>
}
