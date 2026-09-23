import { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { MarketingNav, MarketingFooter } from "@/components/marketing/site"
import { ReceiptTicker } from "@/components/ledger/receipt-ticker"
import { EscalationLadder } from "@/components/ledger/escalation-ladder"
import { Button } from "@/components/ui/button"
import { BrainCircuit, Check, MessageSquareText, ShieldCheck } from "lucide-react"
import { AuthNotice } from "@/components/auth/auth-notice"
import { ProPrice } from "@/components/billing/pro-price"
import { TOOL_CALCULATORS } from "@/lib/seo/tool-calculators"
import { LandingToolTeaser } from "@/components/marketing/landing-tool-teaser"

export const metadata: Metadata = {
  title: "Overdue — Get paid without the awkward conversation",
  description:
    "Automated invoice follow-ups with a tone ladder that gets warmer as it gets firmer. Built for freelancers and small agencies.",
  alternates: { canonical: "/" },
}

const LADDER_STEPS = [
  { id: "g", step_order: 1, delay_days: 1, tone: "gentle" as const, ai_enabled: true, subject_template: "Just checking in on invoice #2026-0914", body_template: "" },
  { id: "n", step_order: 2, delay_days: 6, tone: "nudge" as const, ai_enabled: true, subject_template: "Friendly reminder: invoice #2026-0914", body_template: "" },
  { id: "f", step_order: 3, delay_days: 7, tone: "firm" as const, ai_enabled: true, subject_template: "Invoice #2026-0914 — can you confirm receipt?", body_template: "" },
  { id: "x", step_order: 4, delay_days: 7, tone: "final" as const, ai_enabled: true, subject_template: "Final notice: invoice #2026-0914", body_template: "" },
]

const FAQS = [
  {
    q: "Does this send emails automatically on day one?",
    a: "On Pro, yes — once you import a CSV (or add an invoice) and pick a ladder, each rung goes out on schedule and nothing sends until you've reviewed the draft. On Free, you send each step yourself with one tap from the ledger; every message is drafted first and editable before it ever goes out.",
  },
  {
    q: "Will clients be annoyed?",
    a: "That's the whole point of the ladder. The first touch is a gentle ping a day after due date. It escalates only if nothing happens, and the AI keeps every message human — no boilerplate, no 'gentle reminders' cringe.",
  },
  {
    q: "Which invoice tools do you connect to?",
    a: "Direct PayPal, Stripe, QuickBooks and Xero connections are coming soon. Today, export a CSV from any of them and Smart CSV maps your invoices in under a minute. A manual catch-all still works.",
  },
  {
    q: "Who pays and where does the money go?",
    a: "Overdue bills you through Paddle, a merchant of record that works for solo founders worldwide (including India — no separate entity needed) and handles sales tax; some deploys fall back to Dodo Payments, also a merchant of record. Your client payments still land exactly where they do today.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Plans are monthly, cancellable in two clicks from the billing page, there's a 7-day free trial, and a 30-day money-back policy on Pro.",
  },
]

export default function LandingPage() {
  return (
    <div className="paper-grain min-h-screen bg-paper">
      <MarketingNav />
      <Suspense>
        <AuthNotice />
      </Suspense>

      {/* HERO — asymmetric editorial */}
      <section className="mx-auto max-w-6xl px-5 pt-16 pb-20 lg:pt-24">
        <div className="grid items-start gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-moss" />
              AI-assisted, owner-controlled invoice follow-ups
            </div>
            <h1 className="font-display text-[44px] leading-[1.02] tracking-tight text-ink sm:text-6xl lg:text-[76px]">
              Get paid without
              <br />
              the <em className="font-display italic text-moss">awkward</em> conversation.
            </h1>
            <p className="mt-6 max-w-measure text-lg leading-relaxed text-ink-soft">
              The first reminder goes the day after the due date. The last one arrives with
              a deadline. Everything in between is drafted in your voice, escalated on a
              schedule, and designed to protect the client relationship.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup">
                <Button size="lg">Recover your first invoice free</Button>
              </Link>
              <Link href="/#how">
                <Button size="lg" variant="outline">How it works</Button>
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[12px] uppercase tracking-[0.12em] text-muted">
              <span>any CSV</span><span className="text-hairline">/</span>
              <span>platform syncs coming soon</span>
            </div>
          </div>

          <div className="lg:pl-4">
            <ReceiptTicker />
            <div className="mx-auto mt-5 max-w-md rounded-lg border border-dashed border-hairline p-4 font-mono text-[12px] leading-relaxed text-muted">
              <span className="text-faint"># the ladder in one line:</span>{" "}
              gentle day 1 → nudge day 7 → firm day 14 → final day 21.
            </div>
          </div>
        </div>
      </section>

      {/* TRUST — quiet strip */}
      <section className="border-y border-hairline bg-surface/70">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-8 md:grid-cols-4">
          {[
            ["Day 1", "first reminder goes out on its own"],
            ["Any reply", "pauses the ladder automatically"],
            ["Payment", "stops everything, marks recovered"],
            ["100%", "of follow-ups editable before send"],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="font-display text-2xl text-ink">{k}</div>
              <div className="mt-1 text-[13px] text-muted">{v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* AI — clear value, explicit human controls */}
      <section id="ai" className="border-y border-hairline bg-moss-soft/35 py-20">
        <div className="mx-auto grid max-w-6xl items-start gap-10 px-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">AI Recovery Copilot</div>
            <h2 className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">AI for the awkward words. <em className="italic">You keep control.</em></h2>
            <p className="mt-5 max-w-measure text-lg leading-relaxed text-ink-soft">Overdue uses small, focused AI requests to make chasing clearer and more human. The ledger, amounts, due dates, payment plans, and sending rules always stay deterministic.</p>
            <div className="mt-7 rounded-lg border border-moss/25 bg-paper p-4 text-[13px] leading-relaxed text-muted">
              <span className="font-medium text-ink">No black-box collection decisions.</span> AI never changes a payment amount, accepts a plan, moves a due date, or sends an email without an owner-approved workflow.
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: MessageSquareText, title: "Write in your voice", body: "Draft a short reminder that matches the ladder’s tone. You review the exact email before it sends." },
              { icon: BrainCircuit, title: "Turn replies into next steps", body: "Spot a promise, plan request, payment claim, or dispute—then show the owner the right action." },
              { icon: ShieldCheck, title: "Explain, don’t decide", body: "Summarise the invoice timeline and payment risk from recorded facts so nothing important gets missed." },
            ].map((item) => (
              <article key={item.title} className="rounded-lg border border-hairline bg-surface p-5 shadow-ledger">
                <item.icon size={20} className="text-moss" aria-hidden />
                <h3 className="mt-4 font-display text-xl text-ink">{item.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20">
        <div className="max-w-xl">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">How it works</div>
          <h2 className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">
            Three steps. Then it runs <em className="italic">itself.</em>
          </h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              n: "01",
              title: "Connect your numbers",
              body: "Drop in a CSV from PayPal, Stripe, QuickBooks or Xero. Your unpaid invoices appear in the ledger automatically.",
            },
            {
              n: "02",
              title: "Pick a ladder",
              body: "Start from a proven template or build your own. Each step has a delay, a tone, and an AI draft you can edit.",
            },
            {
              n: "03",
              title: "Get paid, quietly",
              body: "Messages go out on schedule. Any reply pauses the ladder. The moment payment hits, the flame goes out.",
            },
          ].map((s) => (
            <div key={s.n} className="rounded-lg border border-hairline bg-surface p-6 shadow-ledger">
              <div className="font-mono text-[13px] text-faint">{s.n}</div>
              <h3 className="mt-3 font-display text-xl text-ink">{s.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* THE LADDER */}
      <section id="ladder" className="scroll-mt-24 border-y border-hairline bg-surface/70 py-20">
        <div className="mx-auto grid max-w-6xl items-start gap-12 px-5 lg:grid-cols-2">
          <div className="lg:sticky lg:top-28">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ember">The signature</div>
            <h2 className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">
              Four rungs. <em className="italic">One flame.</em>
            </h2>
            <p className="mt-5 max-w-measure text-lg leading-relaxed text-ink-soft">
              Most chasing is too nice to ever collect, or too hostile to stay friends.
              The ladder starts courteous and only gets warmer when it has to — so the
              first message is forgivable and the last one is final.
            </p>
            <div className="mt-8 space-y-3 rounded-lg border border-hairline bg-paper p-5">
              {[
                ["Day past due", "→ ladder starts", "#C29A43"],
                ["No reply by day 7", "→ escalates a rung", "#D9792B"],
                ["No reply by day 14", "→ asks for a date", "#C14E2B"],
                ["No reply by day 21", "→ sets a deadline", "#9E2A23"],
              ].map(([k, v, color]) => (
                <div key={k} className="flex items-center gap-3 font-mono text-[13px]">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
                  <span className="text-ink-soft">{k}</span>
                  <span className="text-faint">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="max-w-md">
            <EscalationLadder steps={LADDER_STEPS} />
          </div>
        </div>
      </section>

      {/* TOOLS — minimal highlight; full calculators live in the workspace */}
      <section id="tools" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">Tools · In your workspace</div>
            <h2 className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">
              Do the math <em className="italic">before</em> you chase.
            </h2>
            <p className="mt-4 max-w-measure text-[15px] leading-relaxed text-muted">
              Five calculators on the same ledger math as Overdue — late fees, aging, collections
              ROI, payment plans and DSO. Type a number, watch the answer move. Nothing leaves
              your browser.
            </p>
            <ul className="mt-6 space-y-2.5">
              {TOOL_CALCULATORS.map((t) => (
                <li key={t.slug} className="flex items-baseline gap-3 text-[14px]">
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-moss">{t.spec.kicker}</span>
                  <span className="text-ink-soft">{t.name}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="/signup">
                <Button size="lg">Use the tools free</Button>
              </a>
              <a href="/login">
                <Button size="lg" variant="outline">Log in</Button>
              </a>
            </div>
          </div>
          <div className="lg:pl-4">
            <LandingToolTeaser slug="late-fee-calculator" />
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20">
        <div className="mx-auto max-w-xl text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">Pricing</div>
          <h2 className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">
            A follow-up autopilot, for the money people owe you.
          </h2>
          <p className="mt-4 text-[15px] text-muted">
            Free while you're getting set up. Pro when there's real money on the line.
            30-day refund, cancel in two clicks.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-3xl gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-hairline bg-surface p-7 shadow-ledger">
            <div className="font-display text-xl text-ink">Free</div>
            <div className="mt-3 font-mono text-[15px] text-muted"><span className="font-display text-3xl text-ink">$0</span> / forever</div>
            <ul className="mt-5 space-y-2.5 text-sm text-ink-soft">
              {["3 clients", "10 invoices", "CSV import", "1 ladder, 1 message per step", "5 AI drafts / month"].map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-moss" strokeWidth={2.5} /> {f}
                </li>
              ))}
            </ul>
            <a href="/signup" className="mt-6 block"><Button variant="paper" className="w-full">Start free</Button></a>
          </div>

          <div className="relative rounded-lg border border-moss/40 bg-surface p-7 shadow-ledger">
            <span className="absolute -top-3 right-5 rounded-full bg-moss px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white">
              The one that pays you back
            </span>
            <div className="font-display text-xl text-ink">Pro</div>
            <div className="mt-3 font-mono text-[15px] text-muted"><ProPrice className="font-display text-3xl text-ink" /> / month</div>
            <ul className="mt-5 space-y-2.5 text-sm text-ink-soft">
              {["Unlimited clients, invoices & ladders", "Smart CSV imports from billing platforms", "Autopilot: follow-ups fire on schedule", "AI drafting, human-voiced", "Reply-detection & auto-pause", "Payment-history scoring"].map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 text-moss" strokeWidth={2.5} /> {f}
                </li>
              ))}
            </ul>
            <a href="/signup" className="mt-6 block"><Button variant="moss" className="w-full">Go Pro</Button></a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-hairline bg-surface/70 py-20">
        <div className="mx-auto max-w-2xl px-5">
          <h2 className="font-display text-3xl tracking-tight text-ink">Fine print, honestly</h2>
          <div className="mt-8 divide-y divide-hairline border-y border-hairline">
            {FAQS.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-ink">
                  {f.q}
                  <span className="font-mono text-faint transition-transform duration-150 group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 max-w-measure text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-hairline bg-moss">
        <div className="mx-auto max-w-4xl px-5 py-20 text-center">
          <h2 className="font-display text-4xl tracking-tight text-white sm:text-5xl">
            Your next invoice goes out <em className="italic text-moss-bright">already covered.</em>
          </h2>
          <p className="mx-auto mt-4 max-w-measure text-[15px] text-paper/80">
            Import your invoice CSV, pick the ladder, and stop being the one who chases.
          </p>
          <div className="mt-8">
            <a href="/signup">
              <Button size="lg" variant="paper" className="border-moss">Start free</Button>
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
