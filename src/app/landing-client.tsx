"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowRight, Mail } from "lucide-react"
import { MarketingNav, MarketingFooter, Wordmark } from "@/components/marketing/site"
import { Button } from "@/components/ui/button"
import { EscalationLadder } from "@/components/ledger/escalation-ladder"

const CHAPTERS = [
  {
    key: "ladder",
    kicker: "Chapter one",
    title: "Your client missed the due date.",
    sub: "Overdue takes it from here.",
    body:
      "Most chasing is either too nice to collect, or too hostile to keep a client. Overdue splits the difference: a short ladder that starts courteous and only gets firmer when it has to. Day one is forgivable. Day twenty-one is final.",
    cta: "Start your 14-day trial",
  },
  {
    key: "how",
    kicker: "Chapter two",
    title: "Three steps. Then it runs itself.",
    sub: "Import, pick a ladder, get paid quietly.",
    body:
      "Upload a CSV export from PayPal, Stripe, QuickBooks, Xero — or any billing tool. Choose a proven ladder or build your own. Every message is drafted for your review before it goes out. Any reply pauses the sequence; a recorded payment closes it.",
    cta: "See the recovery loop",
  },
  {
    key: "pricing",
    kicker: "Chapter three",
    title: "A follow-up autopilot, not another invoice tool.",
    sub: "Try every Pro feature for 14 days, free.",
    body:
      "Unlimited clients, invoices and ladders. Smart CSV import today; direct connections coming soon. After the trial, continue for $19/month only if Overdue earns its place in your workflow. Cancel in two clicks.",
    cta: "Start 14-day free trial",
  },
] as const

const LADDER_STEPS = [
  { id: "g", step_order: 1, delay_days: 1, tone: "gentle" as const, ai_enabled: true, subject_template: "Just checking in on invoice #2026-0914", body_template: "" },
  { id: "n", step_order: 2, delay_days: 6, tone: "nudge" as const, ai_enabled: true, subject_template: "Friendly reminder: invoice #2026-0914", body_template: "" },
  { id: "f", step_order: 3, delay_days: 7, tone: "firm" as const, ai_enabled: true, subject_template: "Invoice #2026-0914 — can you confirm receipt?", body_template: "" },
  { id: "x", step_order: 4, delay_days: 7, tone: "final" as const, ai_enabled: true, subject_template: "Final notice: invoice #2026-0914", body_template: "" },
]

function useInView() {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const handle = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [e] = entries
      if (e?.isIntersecting) setInView(true)
    },
    [],
  )
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(handle, { threshold: 0.12, rootMargin: "0px 0px -10% 0px" })
    obs.observe(el)
    return () => obs.disconnect()
  }, [handle])
  return { ref, inView }
}

function Chapter({ chapter }: { chapter: (typeof CHAPTERS)[number] }) {
  const { ref, inView } = useInView()
  return (
    <section
      ref={ref}
      className={`sticky top-[calc(100vh/2)] h-[calc(100vh-2rem)] w-full overflow-hidden ${inView ? "opacity-100" : "opacity-0 translate-y-10 transition-all duration-700"}`}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-[calc(100vh-2rem)] lg:px-12 lg:grid-cols-2">
        <div className="lg:pr-8">
          <div className="flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-moss" />
            {chapter.kicker}
          </div>
          <h2 className={`mt-3 font-display tracking-tight text-ink sm:text-5xl lg:text-[64px] leading-[1.02] ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          } transition-all duration-600`}>
            {chapter.title}
          </h2>
          <p className={`mt-5 max-w-measure text-[17px] leading-relaxed text-ink-soft ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          } transition-all duration-600 delay-75`}>
            {chapter.body}
          </p>
          <div className={`mt-10 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          } transition-all duration-600 delay-150`}>
            <Link href="/signup" className="inline-flex items-center gap-2">
              <Button variant="moss" size="lg" className="h-13 px-8 text-base font-medium shadow-ledger">
                {chapter.cta} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
              14-day free trial · no card · cancel anytime
            </p>
          </div>
        </div>
        <div className="relative h-full flex items-center justify-center">
          <EscalationLadder steps={LADDER_STEPS} />
          <div className="absolute -right-4 -bottom-4 rounded-full border border-hairline bg-moss p-3 shadow-ledger">
            <Mail className="h-5 w-5 text-paper" />
          </div>
        </div>
      </div>
    </section>
  )
}

export function LandingPage() {
  return (
    <div className="paper-grain min-h-screen bg-paper overflow-x-hidden">
      <MarketingNav />
      <main className="relative z-10">
        {/* HERO — full viewport, CTA first */}
        <section className="relative h-screen w-full overflow-hidden bg-paper">
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <div className="absolute -right-20 -top-32 h-[600px] w-[600px] rounded-full bg-moss/6 blur-[120px]" />
            <div className="absolute left-24 bottom-24 h-32 w-32 rounded-full bg-ember/8 blur-[80px]" />
          </div>
          <div className="mx-auto max-w-5xl px-5 h-full flex flex-col justify-center lg:px-12 lg:max-w-6xl">
            <div className="relative z-10 inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-moss animate-pulse" />
              Recovery workflow for overdue invoices
            </div>
            <h1 className="relative z-10 mt-6 font-display text-[44px] leading-[1.0] tracking-tight text-ink sm:text-6xl lg:text-[80px] xl:text-[96px]">
              Your client missed the due date.
              <br />
              <em className="font-display italic text-moss">Overdue takes it from here.</em>
            </h1>
            <p className="relative z-10 mt-6 max-w-2xl text-[19px] leading-relaxed text-ink-soft">
              Import your invoice list, choose a recovery ladder, and let Overdue handle the
              uncomfortable follow-up. Messages start polite, get firmer only when needed,
              pause when a client replies, and stop the moment payment is recorded.
            </p>
            <div className="relative z-10 mt-10 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-start">
              <Link href="/signup">
                <Button size="lg" className="h-15 px-9 text-base font-medium shadow-ledger bg-ink text-paper hover:bg-moss transition-colors">
                  Start your 14-day trial
                </Button>
              </Link>
              <Link href="/#how" className="relative z-10 inline-flex items-center gap-2 text-[14px] font-medium text-ink hover:text-moss transition-colors">
                How the ladder works <ArrowRight className="ml-1.5 h-4 w-4 opacity-60 group-hover:opacity-100 transition-opacity" />
              </Link>
            </div>
            <p className="relative z-10 mt-5 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
              No card required · Full Pro access · Cancel in two clicks
            </p>
            <div className="relative z-10 mt-8 flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
              <span>Smart CSV today</span>
              <span className="h-px w-px bg-hairline mx-2" />
              <span>PayPal</span>
              <span className="h-px w-px bg-hairline mx-2" />
              <span>Stripe</span>
              <span className="h-px w-px bg-hairline mx-2" />
              <span>QuickBooks</span>
              <span className="h-px w-px bg-hairline mx-2" />
              <span>Xero · coming soon</span>
            </div>
          </div>
          <div className="absolute z-0 right-0 top-0 h-full w-[40%] bg-surface/40 pointer-events-none" />
          <div className="absolute z-0 bottom-12 right-8 w-full max-w-md flex justify-end">
            <div className="rounded-xl border border-hairline bg-surface p-5 shadow-ledger">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-moss">The first rung</div>
              <div className="mt-2 font-mono text-sm text-ink">Gentle day 1 → nudge day 7 → firm day 14 → final day 21.</div>
            </div>
          </div>
        </section>

        {/* Sticky-scroll chapters */}
        {CHAPTERS.map((chapter) => (
          <Chapter key={chapter.key} chapter={chapter} />
        ))}

        {/* Final CTA band */}
        <section className="border-t border-hairline bg-ink">
          <div className="mx-auto max-w-5xl px-5 py-24 text-center lg:px-12">
            <h2 className="font-display text-3xl tracking-tight text-paper sm:text-4xl">
              Your next invoice goes out <em className="italic text-moss-bright">already covered.</em>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-paper/70">
              Import an invoice list, pick the ladder, and stop being the one who chases.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a href="/signup">
                <Button size="lg" variant="paper" className="h-14 px-10 text-base font-medium border-paper/30 hover:bg-paper/10 transition-colors">
                  Start 14-day free trial
                </Button>
              </a>
              <a href="/login" className="text-[14px] font-medium text-paper/60 hover:text-paper transition-colors">
                Already have an account? Sign in
              </a>
            </div>
          </div>
        </section>

        <StickyFloatingCta />
        <MarketingFooter />
      </main>
    </div>
  )
}

function StickyFloatingCta() {
  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 lg:hidden">
      <div className="rounded-full border border-hairline bg-paper px-4 py-2 shadow-2xl backdrop-blur-md">
        <a href="/signup" className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-moss">
          Start trial <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </nav>
  )
}
