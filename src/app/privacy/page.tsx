import { Metadata } from "next"
import Link from "next/link"
import { Wordmark } from "@/components/marketing/site"

export const metadata: Metadata = {
  title: "Privacy Policy",
  alternates: { canonical: "/privacy" },
}

const SECTIONS = [
  {
    h: "The short version",
    b: "Overdue collects the minimum needed to send your invoice reminders and charge you for Pro. We do not sell data, we don't show ads, and you can export or delete everything you give us.",
  },
  {
    h: "What we collect",
    b: "Account details so you can sign in; the invoices, clients and ladders you add; email events (sent, opened, replied) so the ladder can stop when a client answers; and billing data handled by Paddle, our merchant of record, which processes payments and holds no card data on our servers.",
  },
  {
    h: "What we don't do",
    b: "We do not read your stored invoice contents for any purpose other than drafting your reminders and showing you your ledger. We do not train models on your data. We do not send email from your account without your sequence turning it on.",
  },
  {
    h: "Emails",
    b: "Reminder emails are sent from your sender address via Resend, our transactional email provider. Standard open and click events are tracked so we can pause a ladder the instant a client replies or pays.",
  },
  {
    h: "Subprocessors",
    b: "Your data moves through a small number of subprocessors, and nothing more: Vercel (hosting the app), Supabase (authentication, database and row-level security), Resend (sending and receiving reminder emails), Paddle (billing, as merchant of record), the AI provider you enable for drafting reminders, and the invoice providers you connect yourself (Stripe, PayPal or Xero). Each is bound to a written data-processing agreement.",
  },
  {
    h: "Your clients' data",
    b: "When you add a client to Overdue, you are the controller of their personal data and Overdue processes it only on your instructions — to render your ledger and send the reminders you configured. You're responsible for a lawful basis to contact them (we do not cold-email).",
  },
  {
    h: "Your rights",
    b: "If you're in the EEA, UK or elsewhere with data-protection law, you may access, correct, export, restrict or delete your data, and object to processing, at any time from your dashboard or by emailing hello@overdue.app. We respond within 30 days. Reminder emails are processed on the basis of the contract you agree to when you send them.",
  },
  {
    h: "Retention & deletion",
    b: "You can export or delete your account at any time and we will remove your invoices, clients, sequences and messages within 30 days, or sooner on request. Billing records are retained by Paddle as required by law. International transfers are covered by standard contractual clauses when they occur across borders.",
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-hairline bg-paper/90">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-5">
          <Wordmark />
          <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted hover:text-ink">Back home</Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-14">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">Legal</div>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-ink">Privacy Policy</h1>
        <p className="mt-2 font-mono text-[12px] text-faint">Last updated: 30 August 2026</p>
        <div className="mt-10 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="font-display text-xl text-ink">{s.h}</h2>
              <p className="mt-2 max-w-measure text-[14px] leading-relaxed text-ink-soft">{s.b}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}