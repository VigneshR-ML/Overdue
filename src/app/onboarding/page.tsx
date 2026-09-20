"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import { Wordmark } from "@/components/marketing/site"
import { TONE_META } from "@/types"
import {
  absoluteOffsets,
  DEFAULT_LADDER_STEPS,
  CURRENCIES,
  previewMessage,
  type ScheduleRow,
  type StepWithDelay,
} from "@/lib/onboarding/schedule"

type Step = "identity" | "invoice" | "schedule" | "preview" | "done"

interface InvoiceSnapshot {
  id: string
  number: string | null
  client_name: string
  amount_cents: number
  currency: string
  due_date: string
  days_overdue: number
}

interface SequenceRow {
  id: string
  name: string
  is_active: boolean
  is_template: boolean
  steps: StepWithDelay[] | null
}

const PROGRESS: Record<Step, number> = {
  identity: 1,
  invoice: 2,
  schedule: 3,
  preview: 4,
  done: 5,
}

const SAMPLE_DUE_DATE = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)

const SAMPLE_PREVIEW_INVOICE = (_email: string): InvoiceSnapshot => ({
  id: "sample",
  number: "2026-0010",
  client_name: "Northwind Creative",
  amount_cents: 120_000,
  currency: "USD",
  due_date: SAMPLE_DUE_DATE,
  days_overdue: 0,
})

function storageKey(userId: string) {
  return `overdue:onboarding:${userId}`
}

interface StoredDraft {
  step: Step
  invoice?: InvoiceSnapshot | null
}

function loadDraft(userId: string): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredDraft
    if (!parsed || typeof parsed.step !== "string") return null
    return parsed
  } catch {
    return null
  }
}

export default function OnboardingPage() {
  const router = useRouter()
  const userIdRef = useRef<string | null>(null)
  const [step, setStep] = useState<Step>("identity")
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // First invoice form state.
  const [clientName, setClientName] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [number, setNumber] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [dueDate, setDueDate] = useState("")
  const [paymentUrl, setPaymentUrl] = useState("")
  const [noEmailDraft, setNoEmailDraft] = useState(false)

  // Created invoice + ladder for schedule/preview.
  const [invoice, setInvoice] = useState<InvoiceSnapshot | null>(null)
  const [sequences, setSequences] = useState<SequenceRow[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/?signin=1")
        return
      }
      setEmail(data.user.email ?? "")
      userIdRef.current = data.user.id
      const draft = loadDraft(data.user.id)
      if (draft) setStep(draft.step)
      if (draft?.invoice) setInvoice(draft.invoice)
    })
  }, [router])

  // Resume-safe: persist step/invoice after every meaningful change.
  const persist = useCallback((s: Step, inv: InvoiceSnapshot | null) => {
    const uid = userIdRef.current
    if (!uid) return
    try {
      window.localStorage.setItem(storageKey(uid), JSON.stringify({ step: s, invoice: inv } satisfies StoredDraft))
    } catch {
      // Storage unavailable (private mode) — the wizard just won't resume mid-way.
    }
  }, [])

  const goto = useCallback(
    (s: Step) => {
      setStep(s)
      setError(null)
      persist(s, invoice)
    },
    [invoice, persist],
  )

  const loadSequences = useCallback(async () => {
    try {
      const res = await fetch("/api/sequences")
      const json = await res.json()
      if (res.ok && Array.isArray(json?.sequences)) {
        setSequences(json.sequences.filter((s: SequenceRow) => !s.is_template))
      }
    } catch {
      // Keep the default schedule fallback if the ladder list fails to load.
    }
  }, [])

  useEffect(() => {
    // Fetch completion updates state asynchronously; this is not a cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSequences()
  }, [loadSequences])

  const ladder = useMemo<StepWithDelay[]>(() => {
    const mine = sequences.find((s) => s.is_active && Array.isArray(s.steps) && (s.steps?.length ?? 0) > 0)
    return (mine?.steps?.length ? mine.steps : DEFAULT_LADDER_STEPS) as StepWithDelay[]
  }, [sequences])

  const schedule = useMemo<ScheduleRow[]>(() => {
    try {
      return absoluteOffsets(ladder, invoice?.id && invoice.id !== "sample" ? invoice.due_date : undefined)
    } catch {
      return []
    }
  }, [ladder, invoice])

  const firstStep = useMemo(() => {
    const sorted = [...ladder].sort((a, b) => a.step_order - b.step_order)
    return sorted[0] ?? DEFAULT_LADDER_STEPS[0]
  }, [ladder])

  async function saveIdentity() {
    const supabase = createClient()
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError("Session expired — please sign in again.")
        setSaving(false)
        return
      }
      const { error: updateErr } = await supabase.from("profiles").update({ full_name: name || email.split("@")[0] }).eq("id", user.id)
      if (updateErr) {
        setError("Failed to save — try again.")
        setSaving(false)
        return
      }
      goto("invoice")
    } catch {
      setError("Network error — try again.")
    } finally {
      setSaving(false)
    }
  }

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    const cents = Math.round(parseFloat(amount) * 100)
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Enter a valid amount greater than zero.")
      return
    }
    if (!clientName.trim()) {
      setError("Client name is required.")
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
        setError(json?.error ?? "Couldn't add invoice. Try again.")
        return
      }
      const snapshot: InvoiceSnapshot = {
        id: json.id as string,
        number: number.trim() || null,
        client_name: clientName.trim(),
        amount_cents: cents,
        currency,
        due_date: dueDate || new Date().toISOString().slice(0, 10),
        days_overdue: 0,
      }
      setInvoice(snapshot)
      setClientName(""); setClientEmail(""); setNumber(""); setAmount(""); setDueDate(""); setPaymentUrl(""); setNoEmailDraft(false)
      await loadSequences()
      goto("schedule")
    } catch {
      setError("Network error — try again.")
    } finally {
      setSaving(false)
    }
  }

  async function finish() {
    const supabase = createClient()
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError("Session expired — please sign in again.")
        setSaving(false)
        return
      }
      const { error: err } = await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", user.id)
      if (err) {
        // (UX-01) Completion is only trusted once confirmed — do not navigate
        // away on a failed write or the dashboard would keep showing the
        // welcome banner and the journey would feel lost.
        setError("Couldn't save your progress — please try again.")
        setSaving(false)
        return
      }
      try {
        window.localStorage.removeItem(storageKey(user.id))
      } catch {}
      router.push("/dashboard")
    } catch {
      setError("Network error — please try again.")
      setSaving(false)
    }
  }

  const stepNumber = PROGRESS[step]

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-5 py-12">
      <div className="w-full max-w-xl">
        <div className="mb-8 flex justify-center"><Wordmark /></div>

        <div className="mb-6 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-moss">
          Step {stepNumber} of 5
          <span className="hidden items-center gap-2 sm:inline-flex">
            {(["identity", "invoice", "schedule", "preview", "done"] as Step[]).map((s) => (
              <span key={s} aria-hidden className={`h-1.5 w-1.5 rounded-full ${PROGRESS[step] >= PROGRESS[s] ? "bg-moss" : "bg-hairline"}`} />
            ))}
          </span>
        </div>

        {step === "identity" && (
          <div className="rounded-lg border border-hairline bg-surface p-7 shadow-ledger">
            <h1 className="font-display text-2xl tracking-tight text-ink">What do we call you in emails?</h1>
            <p className="mt-1.5 text-sm text-muted">Signs off as this name on every reminder rung. Change anytime.</p>
            <div className="mt-6 space-y-4">
              <Field label="Email">
                <Input value={email} disabled className="font-mono text-[13px] opacity-70" />
              </Field>
              <Field label="Your name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={email.split("@")[0] || "Ada Lovelace"} autoFocus />
              </Field>
              {error && <p className="text-[13px] text-crimson" role="alert">{error}</p>}
              <Button className="w-full" size="lg" onClick={saveIdentity} disabled={saving}>
                {saving ? "Saving…" : "Continue"}
              </Button>
            </div>
          </div>
        )}

        {step === "invoice" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-hairline bg-surface p-7 shadow-ledger">
              <h1 className="font-display text-2xl tracking-tight text-ink">Add your first invoice.</h1>
              <p className="mt-1.5 text-sm text-muted">
                The cheapest way in. Existing invoices from a source you already bill from can sync later.
              </p>

              <form onSubmit={createInvoice} className="mt-6 grid gap-4 sm:grid-cols-2">
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
                    <Input type="url" value={paymentUrl} onChange={(e) => setPaymentUrl(e.target.value)} placeholder="https://…your client pays this invoice" />
                  </Field>
                </div>
                {!clientEmail && (
                  <label className="flex items-start gap-2 text-[13px] text-muted sm:col-span-2">
                    <input type="checkbox" checked={noEmailDraft} onChange={(e) => setNoEmailDraft(e.target.checked)} className="mt-1" />
                    Save without an email — this invoice stays a draft and reminders can&apos;t be sent until a client email is added.
                  </label>
                )}
                {error ? <p className="text-[13px] text-crimson sm:col-span-2" role="alert">{error}</p> : null}
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Button type="submit" disabled={saving}>{saving ? "Adding…" : "Save invoice & review schedule"}</Button>
                  <Button type="button" variant="ghost" onClick={() => goto("schedule")}>Skip for now</Button>
                </div>
              </form>
            </div>

            <div className="rounded-lg border border-hairline bg-surface p-6 shadow-ledger">
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">Prefer an import or a sync?</div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <Link href="/tools/smart-csv?next=/onboarding" className="rounded-md border border-hairline bg-paper p-3 text-[13px] text-moss hover:border-moss/40">
                  Import a CSV →
                </Link>
                <Link href="/settings/integrations?next=/onboarding" className="rounded-md border border-hairline bg-paper p-3 text-[13px] text-moss hover:border-moss/40">
                  Connect PayPal / Xero / Stripe →
                </Link>
                <Button variant="ghost" size="sm" onClick={() => goto("identity")} className="justify-self-start text-[13px]">
                  ← Back
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "schedule" && (
          <div className="rounded-lg border border-hairline bg-surface p-7 shadow-ledger">
            <h1 className="font-display text-2xl tracking-tight text-ink">Your reminder schedule.</h1>
            <p className="mt-1.5 text-sm text-muted">
              {invoice && invoice.id !== "sample"
                ? `For invoice ${invoice.number ?? "—"} due ${invoice.due_date}, the ladder fires like this:`
                : "Here's what the default ladder does after each due date:"}
            </p>
            <div className="mt-5 overflow-hidden rounded-lg border border-hairline">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline bg-paper/60 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                    <th className="px-4 py-2.5 text-left font-medium">Rung</th>
                    <th className="px-4 py-2.5 text-left font-medium">Tone</th>
                    <th className="px-4 py-2.5 text-right font-medium">Fires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {schedule.map((r) => {
                    const meta = TONE_META[r.tone as keyof typeof TONE_META] ?? TONE_META.gentle
                    return (
                      <tr key={r.step_order}>
                        <td className="px-4 py-2.5 font-mono text-[13px] text-ink">#{r.step_order}</td>
                        <td className="px-4 py-2.5 text-[13px] capitalize" style={{ color: meta.color }}>{meta.label}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-[13px] text-muted">{r.when}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-4 font-mono text-[11px] leading-relaxed text-faint">
              Delays are gaps between rungs — the day offsets above are cumulative. Nothing sends until the ladder starts:
              on Free you press Send now per invoice; Pro sends each rung on schedule automatically.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="moss" onClick={() => goto("preview")}>Review the exact email</Button>
              <Button variant="ghost" onClick={() => goto("invoice")}>← Back</Button>
            </div>
          </div>
        )}

        {step === "preview" && (() => {
          const preview = previewMessage(
            firstStep,
            {
              number: invoice?.id !== "sample" ? invoice?.number ?? null : null,
              client_name: invoice?.id !== "sample" ? invoice?.client_name ?? "" : "Northwind Creative",
              amount_cents: invoice?.amount_cents ?? 120_000,
              currency: invoice?.currency ?? "USD",
              due_date: invoice?.id !== "sample" ? (invoice?.due_date ?? null) : SAMPLE_DUE_DATE,
              issue_date: null,
              days_overdue: invoice?.days_overdue ?? 0,
            },
            name || email.split("@")[0],
          )
          return (
            <div className="space-y-4">
              <div className="rounded-lg border border-hairline bg-surface p-7 shadow-ledger">
                <div className="flex items-baseline justify-between gap-2">
                  <h1 className="font-display text-2xl tracking-tight text-ink">Preview the first reminder.</h1>
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-moss">{firstStep.tone}</span>
                </div>
                <p className="mt-1.5 text-sm text-muted">
                  {invoice && invoice.id !== "sample"
                    ? `This is the exact message that goes to ${invoice.client_name} — drafted from your ladder.`
                    : "This is how the first rung reads for a sample invoice."}
                </p>
                <div className="mt-5 rounded-lg border border-hairline bg-paper p-5">
                  <div className="text-[13px] font-medium text-ink">{preview.subject || "—"}</div>
                  <div className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-ink-soft">{preview.body}</div>
                </div>
                <p className="mt-4 text-[13px] text-muted">
                  You can edit every draft before it goes out. On Free, nothing sends until you press{" "}
                  <span className="font-medium text-ink">Send now</span>; on Pro the schedule above runs it for you.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="ghost" onClick={() => goto("schedule")}>← Back</Button>
                <Button variant="moss" size="lg" onClick={finish} disabled={saving}>
                  {saving ? "Saving…" : invoice && invoice.id !== "sample" ? "Save & open the ledger" : "Open the ledger"}
                </Button>
              </div>
              {error && <p className="font-mono text-[12px] text-crimson" role="alert">{error}</p>}
            </div>
          )
        })()}

        {step === "done" && (
          <div className="rounded-lg border border-hairline bg-surface p-7 text-center shadow-ledger">
            <h1 className="font-display text-2xl tracking-tight text-ink">You&apos;re set up.</h1>
            <p className="mt-2 text-sm text-muted">
              {invoice && invoice.id !== "sample"
                ? `Invoice ${invoice.number ?? "—"} is in the ledger with a ladder attached.`
                : "Your ledger is ready — add an invoice whenever you like."}
            </p>
            <div className="mt-6">
              <Button className="w-full" size="lg" variant="moss" onClick={() => router.push("/dashboard")}>
                Open the ledger
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
