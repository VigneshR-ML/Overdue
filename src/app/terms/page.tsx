import { Metadata } from "next"
import Link from "next/link"
import { Wordmark } from "@/components/marketing/site"

export const metadata: Metadata = {
  title: "Terms of Service",
  alternates: { canonical: "/terms" },
}

const SECTIONS = [
  {
    h: "1. The deal",
    b: "Overdue is a service that helps you follow up on unpaid invoices. By creating an account you agree to these terms. 'We' are the operators of Overdue; 'you' are the person or business using it.",
  },
  {
    h: "2. Your responsibility for what you send",
    b: "You own and are responsible for the reminder emails sent through your account, including their content, legality, and recipients. Where AI drafting is enabled, AI-generated drafts are still your messages — review them before they go out, and never send anything you wouldn't stand behind. Do not use Overdue for spam, threats, debt-collection claims you are not entitled to make, or harassment. For your clients' personal data, you are the data controller and Overdue processes on your instructions.",
  },
  {
    h: "3. Merchant of record",
    b: "Paddle is our merchant of record. When you buy Pro, your payment contract is with Paddle, which handles charges, refunds, sales tax, and payment disputes. Pro is billed monthly and renews automatically until cancelled. You can cancel at any time from the billing page; access continues until the paid period ends.",
  },
  {
    h: "4. 30-day refund",
    b: "If Pro does not work out within the first 30 days, contact us and we will refund it in full. After that, refunds are handled under Paddle's reseller policy.",
  },
  {
    h: "5. Fair use",
    b: "The free plan is limited as described on the pricing page. We may throttle or suspend accounts that materially abuse the service (bulk spamming, reselling access, scraping). We will always email you first.",
  },
  {
    h: "6. Uptime & availability",
    b: "We work hard to keep Overdue reliable, but we make no guarantee of uninterrupted availability. You remain responsible for your own records — export important data. We are not liable for indirect losses, interference with your business, or lost profits.",
  },
  {
    h: "7. Changes",
    b: "We may update these terms as the product evolves. Material changes will be announced by email. Continued use after a change means acceptance.",
  },
  {
    h: "8. Contact",
    b: "Questions about these terms: hello@overdue.app. This service is operated from India with customers worldwide; e-commerce is facilitated by Paddle as merchant of record.",
  },
]

export default function TermsPage() {
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
        <h1 className="mt-3 font-display text-4xl tracking-tight text-ink">Terms of Service</h1>
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