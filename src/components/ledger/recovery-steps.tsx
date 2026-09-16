import Link from "next/link"

/**
 * How recovery works — the 5-step pipeline, always visible on the ledger so
 * owners (and first-time users) can see where every invoice sits: import →
 * ladder attached → optional settlement offer → mails go out → debtor pays
 * or resolves. Static copy; per-invoice state lives in the table + cards.
 */
const STEPS: { n: string; title: string; body: string; href?: string; linkLabel?: string }[] = [
  {
    n: "1",
    title: "Invoice lands in the ledger",
    body: "Import a CSV, connect Xero / PayPal / Stripe, or add it manually. A ladder attaches automatically.",
  },
  {
    n: "2",
    title: "Ladder queues the reminders",
    body: "Each rung waits its turn — gentle, nudge, firm, final. Nothing sends until its date comes.",
    href: "/sequences",
    linkLabel: "View ladders",
  },
  {
    n: "3",
    title: "Optional: approve a settlement offer",
    body: "Smart Settlement proposes a resolve-today price. Approving attaches a Resolve button to the next reminder — no hand-sending links.",
  },
  {
    n: "4",
    title: "Mails go out",
    body: "Pro autopilot sends every due rung hourly. On Free, press Send now on each invoice.",
    href: "/settings/billing",
    linkLabel: "Autopilot is Pro",
  },
  {
    n: "5",
    title: "Debtor pays or resolves",
    body: "They pay via your link, accept the offer, promise a date (reminders pause), or dispute (chasing pauses). Paid flips automatically.",
  },
]

export function RecoverySteps() {
  return (
    <section aria-label="How recovery works" className="rounded-lg border border-hairline bg-surface p-5 shadow-ledger">
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">How recovery works · 5 steps</div>
      <ol className="mt-3 grid gap-3 md:grid-cols-5">
        {STEPS.map((s) => (
          <li key={s.n} className="rounded-md border border-hairline bg-paper p-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-moss-soft font-mono text-[11px] text-moss">
                {s.n}
              </span>
              <span className="text-[13px] font-medium text-ink">{s.title}</span>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{s.body}</p>
            {s.href ? (
              <Link
                href={s.href}
                className="mt-1.5 inline-block font-mono text-[11px] text-moss underline decoration-hairline underline-offset-2"
              >
                {s.linkLabel} →
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  )
}
