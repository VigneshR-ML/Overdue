"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/input"
import { Wordmark } from "@/components/marketing/site"

type Step = "identity" | "source" | "ladder"

export default function OnboardingPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [step, setStep] = useState<Step>("identity")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/?signin=1")
      setEmail(data.user?.email ?? "")
    })
  }, [router])

  const [error, setError] = useState<string | null>(null)

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
      const { error: updateErr } = await supabase.from("profiles").update({ full_name: name || email.split("@")[0], onboarding_completed: true }).eq("id", user.id)
      if (updateErr) {
        setError("Failed to save — try again.")
        setSaving(false)
        return
      }
      setStep("source")
    } catch {
      setError("Network error — try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Wordmark /></div>

        {step === "identity" && (
          <div className="rounded-lg border border-hairline bg-surface p-7 shadow-ledger">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">Step 1 of 3</div>
            <h1 className="mt-2 font-display text-2xl tracking-tight text-ink">What do we call you in emails?</h1>
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

        {step === "source" && (
          <div className="rounded-lg border border-hairline bg-surface p-7 shadow-ledger">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">Step 2 of 3</div>
            <h1 className="mt-2 font-display text-2xl tracking-tight text-ink">Where do you bill from?</h1>
            <p className="mt-1.5 text-sm text-muted">Connect it and your unpaid invoices flow into the ledger, ladders attached automatically.</p>
            <div className="mt-6 space-y-2.5">
              <a href="/settings/integrations" className="block">
                <Button className="w-full" variant="outline" size="lg">Connect invoicing source</Button>
              </a>
              <Button className="w-full" variant="ghost" size="lg" onClick={() => setStep("ladder")}>
                Skip — manual / CSV once I need it
              </Button>
            </div>
          </div>
        )}

        {step === "ladder" && (
          <div className="rounded-lg border border-hairline bg-surface p-7 shadow-ledger">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">Step 3 of 3</div>
            <h1 className="mt-2 font-display text-2xl tracking-tight text-ink">You're all set.</h1>
            <p className="mt-1.5 text-sm text-muted">
              Create a ladder from Ladders → New, and Overdue will start with a gentle day-1 nudge,
              escalating only if nothing happens. It stops the second a client replies or pays.
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