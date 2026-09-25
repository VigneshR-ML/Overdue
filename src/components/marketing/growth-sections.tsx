"use client"

import { useMemo, useRef, useState } from "react"
import { ArrowRight, Check, CheckCircle2, Clock3, Download, FileCheck2, LockKeyhole, Mail, Pause, Play, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ProductDemoSection() {
  return (
    <section aria-labelledby="demo-heading" className="border-y border-hairline bg-surface/65 py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">60-second product tour</div>
          <h2 id="demo-heading" className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">
            See the whole recovery loop before you sign in.
          </h2>
          <p className="mt-4 max-w-measure text-[15px] leading-relaxed text-muted">
            Import, choose a ladder, listen for a reply, and close the loop when money arrives. This animated walkthrough is the short version of the product.
          </p>
          <a className="mt-7 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-moss hover:text-moss-bright" href="/signup">
            Try this workflow free <ArrowRight className="h-4 w-4" />
          </a>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-hairline bg-paper p-5 shadow-ledger sm:p-7">
          <div className="flex items-center justify-between border-b border-hairline pb-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Overdue / recovery run</span>
            <span className="rounded-full bg-moss-soft px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-moss">live preview</span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
            {[
              ["01", "CSV imported", "12 invoices ready", "bg-moss-soft text-moss"],
              ["02", "Reply detected", "ladder paused", "bg-brass/15 text-ember"],
              ["03", "Payment recorded", "invoice recovered", "bg-moss text-white"],
            ].map(([number, title, detail, tone], index) => (
              <div key={number} className="demo-step rounded-xl border border-hairline bg-surface p-4" style={{ animationDelay: `${index * 1.4}s` }}>
                <div className={`inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-[10px] ${tone}`}>{number}</div>
                <div className="mt-3 text-sm font-medium text-ink">{title}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">{detail}</div>
              </div>
            ))}
            <ArrowRight className="mx-auto hidden h-4 w-4 text-faint sm:block" aria-hidden="true" />
            <ArrowRight className="mx-auto hidden h-4 w-4 text-faint sm:block" aria-hidden="true" />
          </div>
          <div className="mt-6 rounded-lg border border-dashed border-hairline bg-surface/70 p-4">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-moss" />
              <div className="flex-1 text-[13px] text-ink-soft">“I can pay this on Friday.”</div>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-moss">promise saved</span>
            </div>
          </div>
          <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-moss/10 blur-3xl" />
        </div>
      </div>
    </section>
  )
}

export function SocialVideoSection() {
  const storyboard = "Hook: The invoice is late.\nProblem: Another reminder feels awkward.\nPayoff: A reply pauses the ladder and saves the promise date.\nCTA: Try the recovery loop free at getoverdue.online"
  return <section aria-labelledby="social-video-heading" className="border-y border-hairline bg-moss py-20 text-paper"><div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="font-mono text-[11px] uppercase tracking-[0.16em] text-paper/60">Social clip storyboard</div><h2 id="social-video-heading" className="mt-3 max-w-xl font-display text-4xl tracking-tight sm:text-5xl">A short story people understand before they know the product.</h2><p className="mt-4 max-w-measure text-[15px] leading-relaxed text-paper/75">Use this vertical motion graphic as a LinkedIn or X clip: late invoice, reply detected, ladder paused, promise saved.</p><button type="button" onClick={() => navigator.clipboard?.writeText(storyboard)} className="mt-7 inline-flex items-center gap-2 rounded-md border border-paper/30 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-paper transition-colors hover:bg-paper/10"><Download className="h-4 w-4" /> Copy storyboard</button></div><div className="mx-auto w-[220px] rounded-[2rem] border-4 border-paper/20 bg-ink p-2 shadow-2xl"><div className="social-video-screen relative flex aspect-[9/16] flex-col justify-between overflow-hidden rounded-[1.4rem] bg-paper p-5 text-ink"><div className="font-mono text-[9px] uppercase tracking-[0.14em] text-moss">Overdue · 0:15</div><div className="social-video-pulse"><div className="font-display text-3xl leading-none">Invoice<br /><em className="text-moss">overdue.</em></div><div className="mt-5 rounded-lg border border-hairline bg-surface p-3 text-[11px] text-muted">“I can pay on Friday.”</div></div><div><div className="h-1.5 rounded-full bg-hairline"><div className="social-video-progress h-full rounded-full bg-ember" /></div><div className="mt-3 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.1em] text-faint"><span>reply detected</span><span>ladder paused</span></div></div></div></div></div></section>
}

export function BeforeAfterSection() {
  return (
    <section aria-labelledby="before-after-heading" className="mx-auto max-w-6xl px-5 py-20">
      <div className="max-w-xl">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ember">Before / after</div>
        <h2 id="before-after-heading" className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">Replace the awkward loop with a visible one.</h2>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-hairline bg-surface p-6 shadow-ledger">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Before Overdue</div>
          <div className="mt-5 space-y-3 text-sm text-muted">
            {["Search an inbox for the last reminder", "Wonder whether the client saw it", "Forget the date they promised", "Send an apologetic follow-up", "Update a spreadsheet by hand"].map((line) => <div key={line} className="flex gap-3"><span className="text-rust">×</span>{line}</div>)}
          </div>
        </div>
        <div className="rounded-xl border border-moss/30 bg-moss-soft/50 p-6 shadow-ledger">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-moss">After Overdue</div>
          <div className="mt-5 space-y-3 text-sm text-ink-soft">
            {["See the next recovery step", "Pause automatically when they reply", "Track promises and missed dates", "Edit a human draft before sending", "Keep the payment ledger current"].map((line) => <div key={line} className="flex gap-3"><Check className="h-4 w-4 shrink-0 text-moss" />{line}</div>)}
          </div>
        </div>
      </div>
    </section>
  )
}

export function ReplyDemo() {
  const [step, setStep] = useState(0)
  const states = [
    { label: "No reply yet", detail: "Next gentle reminder is scheduled for tomorrow.", icon: Clock3, color: "text-ember" },
    { label: "Client replied", detail: "The ladder paused. Overdue found a promised date in the reply.", icon: Pause, color: "text-brass" },
    { label: "Promise tracked", detail: "The owner gets one clear next action: check payment on Friday.", icon: CheckCircle2, color: "text-moss" },
  ] as const
  const current = states[step]
  const Icon = current.icon
  return (
    <section aria-labelledby="reply-demo-heading" className="border-y border-hairline bg-surface/65 py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">Try the reply loop</div>
          <h2 id="reply-demo-heading" className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">What happens after a reply?</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">Click through the three moments that keep a polite follow-up from becoming an awkward chase.</p>
          <div className="mt-7 flex gap-2">
            {states.map((item, index) => <button key={item.label} type="button" onClick={() => setStep(index)} className={`h-2 flex-1 rounded-full ${index <= step ? "bg-moss" : "bg-hairline"}`} aria-label={`Show step ${index + 1}`} />)}
          </div>
        </div>
        <div className="rounded-2xl border border-hairline bg-paper p-6 shadow-ledger sm:p-8">
          <div className="flex items-start gap-4">
            <div className={`rounded-full bg-surface p-3 ${current.color}`}><Icon className="h-5 w-5" /></div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Invoice #2026-0914</div>
              <h3 className="mt-2 font-display text-2xl text-ink">{current.label}</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{current.detail}</p>
            </div>
          </div>
          <div className="mt-7 rounded-xl border border-hairline bg-surface p-4">
            <div className="flex items-center gap-3 text-sm text-ink-soft"><Mail className="h-4 w-4 text-moss" /> {step === 0 ? "Reminder ready for your review" : step === 1 ? "Reply: “I can pay this on Friday.”" : "Promise date: Friday · ladder paused"}</div>
          </div>
          <div className="mt-6 flex justify-end"><Button type="button" variant="outline" onClick={() => setStep((step + 1) % states.length)}><Play className="mr-2 h-4 w-4" />Next moment</Button></div>
        </div>
      </div>
    </section>
  )
}

export function RecoveryScoreTool() {
  const [amount, setAmount] = useState("12000")
  const [invoices, setInvoices] = useState("8")
  const [days, setDays] = useState("24")
  const score = useMemo(() => {
    const total = Math.max(0, Number(amount.replace(/,/g, "")) || 0)
    const count = Math.max(0, Number(invoices) || 0)
    const age = Math.max(0, Number(days) || 0)
    const raw = 92 - Math.min(42, age * 1.1) - Math.min(20, count * 1.2) + (total > 10000 ? 4 : 0)
    return Math.round(Math.max(18, Math.min(96, raw)))
  }, [amount, invoices, days])
  const report = `Overdue recovery score: ${score}/100 · $${amount || "0"} outstanding across ${invoices || "0"} invoices · average ${days || "0"} days overdue.`
  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) await navigator.share({ title: "Overdue recovery score", text: report, url: `${window.location.origin}/recovery-score` })
    else await navigator.clipboard?.writeText(report)
  }
  return (
    <section aria-labelledby="recovery-score-heading" className="mx-auto max-w-6xl px-5 py-20">
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ember">Free tool · shareable report</div>
          <h2 id="recovery-score-heading" className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">How recoverable is your overdue book?</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">A directional score, not a credit decision. Use it to decide which invoices deserve a human follow-up today.</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-surface p-6 shadow-ledger sm:p-8">
          <div className="grid gap-4 sm:grid-cols-3">
            {[["Outstanding $", amount, setAmount], ["Open invoices", invoices, setInvoices], ["Avg. days late", days, setDays]].map(([label, value, setter]) => <label key={label as string} className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{label as string}<input className="mt-2 w-full rounded-md border border-hairline bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-moss" value={value as string} onChange={(e) => (setter as (value: string) => void)(e.target.value)} inputMode="decimal" /></label>)}
          </div>
          <div className="mt-7 flex flex-col gap-5 rounded-xl bg-paper p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Recovery score</div><div className="mt-1 font-display text-5xl text-moss">{score}<span className="text-2xl text-faint">/100</span></div></div>
            <div className="max-w-xs text-sm leading-relaxed text-muted">{score >= 70 ? "Good moment to start a calm ladder before the balance gets older." : "Prioritise the oldest, highest-value invoices and ask for a date."}</div>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3"><span className="font-mono text-[10px] text-faint">Nothing leaves your browser.</span><Button type="button" variant="outline" onClick={share}>Share report</Button></div>
        </div>
      </div>
    </section>
  )
}

export function CsvHealthCheck() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [result, setResult] = useState<{ headers: string[]; rows: number; message: string } | null>(null)
  function readFile(file?: File) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? "")
      const lines = text.split(/\r?\n/).filter(Boolean)
      const headers = (lines[0] ?? "").split(",").map((cell) => cell.trim().replace(/^"|"$/g, "")).filter(Boolean)
      const required = headers.some((header) => /amount|total|balance/i.test(header)) && headers.some((header) => /email|client|customer/i.test(header))
      setResult({ headers, rows: Math.max(0, lines.length - 1), message: required ? "Looks ready for Smart CSV mapping." : "Add an amount and client/email column before importing." })
    }
    reader.readAsText(file)
  }
  return (
    <section aria-labelledby="csv-check-heading" className="border-y border-hairline bg-surface/65 py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div><div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">Free CSV health check</div><h2 id="csv-check-heading" className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">Know if your export is ready before you import it.</h2><p className="mt-4 max-w-measure text-[15px] leading-relaxed text-muted">Drop in a CSV locally. We check the headers and row count in your browser and show a safe preview—no upload, no account required.</p></div>
        <div className="rounded-2xl border border-dashed border-moss/40 bg-moss-soft/40 p-6 text-center shadow-ledger sm:p-9">
          <Upload className="mx-auto h-7 w-7 text-moss" /><h3 className="mt-3 font-display text-2xl text-ink">Check an invoice export</h3><p className="mt-2 text-sm text-muted">PayPal, Stripe, QuickBooks, Xero or any spreadsheet.</p>
          <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => readFile(e.target.files?.[0])} />
          <Button type="button" className="mt-5" onClick={() => inputRef.current?.click()}>Choose CSV</Button>
          {result ? <div className="mt-6 rounded-xl border border-hairline bg-surface p-4 text-left"><div className="flex items-center gap-2 text-sm font-medium text-ink"><FileCheck2 className="h-4 w-4 text-moss" /> {result.rows} data rows found</div><p className="mt-2 text-sm text-muted">{result.message}</p><div className="mt-3 flex flex-wrap gap-1.5">{result.headers.slice(0, 8).map((header) => <span key={header} className="rounded-full bg-paper px-2 py-1 font-mono text-[10px] text-muted">{header}</span>)}</div></div> : null}
        </div>
      </div>
    </section>
  )
}

export function IntegrationStatusBlock() {
  const integrations = [["Smart CSV", "available", true], ["QuickBooks", "coming soon", false], ["Xero", "coming soon", false], ["Stripe", "coming soon", false], ["PayPal", "coming soon", false]] as const
  return <section aria-labelledby="integration-heading" className="mx-auto max-w-6xl px-5 py-16"><div className="rounded-2xl border border-hairline bg-surface p-6 shadow-ledger sm:p-8"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">Integration status</div><h2 id="integration-heading" className="mt-2 font-display text-3xl text-ink">Start with the export you already have.</h2></div><span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">No inflated promises</span></div><div className="mt-7 grid gap-3 sm:grid-cols-5">{integrations.map(([name, status, ready]) => <div key={name} className="rounded-lg border border-hairline bg-paper p-4"><div className="flex items-center gap-2 text-sm font-medium text-ink"><span className={`h-2 w-2 rounded-full ${ready ? "bg-moss" : "bg-faint"}`} />{name}</div><div className={`mt-2 font-mono text-[10px] uppercase tracking-[0.1em] ${ready ? "text-moss" : "text-faint"}`}>{status}</div></div>)}</div></div></section>
}

export function SetupAndTrustSections() {
  return <>
    <section aria-labelledby="setup-heading" className="border-y border-hairline bg-paper py-20"><div className="mx-auto max-w-6xl px-5"><div className="max-w-xl"><div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ember">15-minute setup</div><h2 id="setup-heading" className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">From spreadsheet to first reviewed follow-up.</h2></div><div className="mt-10 grid gap-4 md:grid-cols-4">{[["01", "Drop in CSV", "No connector project required."], ["02", "Check the preview", "Amounts, dates and recipients stay visible."], ["03", "Pick your tone", "Gentle, nudge, firm or final."], ["04", "Review and send", "You stay in control of the first touch."]].map(([number, title, detail]) => <div key={number} className="rounded-xl border border-hairline bg-surface p-5 shadow-ledger"><div className="font-mono text-[11px] text-moss">{number}</div><h3 className="mt-4 font-display text-xl text-ink">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted">{detail}</p></div>)}</div></div></section>
    <section aria-labelledby="founder-heading" className="mx-auto max-w-6xl px-5 py-20"><div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-center"><div className="rounded-2xl bg-moss p-7 text-paper shadow-ledger"><div className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper/60">A note from the founder</div><div className="mt-5 font-display text-3xl leading-tight">The work is done. Asking to be paid shouldn&apos;t become another job.</div></div><div><h2 id="founder-heading" className="font-display text-3xl text-ink sm:text-4xl">Built for the moment after “due.”</h2><p className="mt-4 max-w-measure text-[15px] leading-relaxed text-muted">Overdue started with a simple observation: good businesses do not need more invoice software. They need a calm, consistent way to handle the uncomfortable follow-up after a client misses a date.</p><p className="mt-4 max-w-measure text-[15px] leading-relaxed text-muted">The product is intentionally owner-controlled. It drafts the words, remembers the promise and shows the next action. You decide what leaves your name.</p><div className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-moss">Vignesh · building Overdue</div></div></div></section>
    <section aria-labelledby="concierge-heading" className="border-y border-hairline bg-surface/65 py-20"><div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">Concierge setup</div><h2 id="concierge-heading" className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">Want your first ladder configured for you?</h2><p className="mt-4 max-w-measure text-[15px] leading-relaxed text-muted">Send your overdue invoice export. We will clean the columns, configure the recovery steps and prepare your first 10 messages for review.</p></div><a href="mailto:hello@getoverdue.online?subject=Concierge%20setup"><Button size="lg">Ask about setup <ArrowRight className="ml-2 h-4 w-4" /></Button></a></div></section>
    <section aria-labelledby="trust-heading" className="mx-auto max-w-6xl px-5 py-20"><div className="max-w-xl"><div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">Trust, in plain language</div><h2 id="trust-heading" className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">Your ledger stays yours.</h2></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[[LockKeyhole, "Security", "Encrypted connections and row-level access controls."], [FileCheck2, "Privacy", "We do not sell your invoice data or train on it."], [Download, "Export", "Download your account data when you need it."], [CheckCircle2, "Deletion", "Delete your account or request help from support."]].map(([Icon, title, detail]) => { const SafeIcon = Icon as typeof LockKeyhole; return <div key={title as string} className="rounded-xl border border-hairline bg-surface p-5 shadow-ledger"><SafeIcon className="h-5 w-5 text-moss" /><h3 className="mt-4 font-display text-xl text-ink">{title as string}</h3><p className="mt-2 text-sm leading-relaxed text-muted">{detail as string}</p></div> })}</div></section>
  </>
}

export function VerifiedFeedbackPlaceholder() {
  return <section aria-labelledby="verified-heading" className="border-y border-hairline bg-paper py-16"><div className="mx-auto max-w-4xl px-5 text-center"><div className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Verified customer feedback</div><h2 id="verified-heading" className="mt-3 font-display text-3xl tracking-tight text-ink">Real words, when customers give permission.</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted">We will publish the customer name, role and source link only after permission. Until then, this space stays honest.</p><a href="mailto:hello@getoverdue.online?subject=Pilot%20feedback"><Button className="mt-6" variant="outline">Join the pilot</Button></a></div></section>
}
