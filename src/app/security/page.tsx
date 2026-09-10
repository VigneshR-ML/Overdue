import { Metadata } from "next"
import Link from "next/link"
import { Wordmark } from "@/components/marketing/site"

export const metadata: Metadata = {
  title: "Security — How Overdue Protects Your Data",
  description:
    "How Overdue secures your account, invoices, and client emails: encryption, isolated data, OAuth scopes, signed webhooks, and deletion.",
  alternates: { canonical: "/security" },
}

const SECTIONS = [
  {
    h: "1. Infrastructure",
    b: "Overdue runs on Vercel (hosting, TLS everywhere) and Supabase (managed Postgres in SOC 2-audited data centers). All traffic is encrypted in transit; database data is encrypted at rest.",
  },
  {
    h: "2. Authentication",
    b: "Sign in with email + password or Google OAuth via Supabase Auth. Passwords are hashed by the auth provider and never visible to us. Sessions are HTTP-only cookies scoped to getoverdue.online.",
  },
  {
    h: "3. Your data stays yours — and isolated",
    b: "Every row (clients, invoices, ladders, messages) belongs to exactly one user id, enforced by Postgres Row Level Security. Users can only ever read their own ledger, even if an API bug tried otherwise.",
  },
  {
    h: "4. Invoice integrations (OAuth scopes)",
    b: "Stripe connects via Stripe Connect OAuth (read access to invoices). Xero uses OAuth2 requesting only accounting.transactions.read, accounting.contacts.read and offline_access (token refresh). PayPal uses your own API credentials, stored per-user. We request the minimum scopes needed to sync invoices — never payouts, never bank access.",
  },
  {
    h: "5. Credentials at rest",
    b: "Connected-account tokens are stored server-side only (never in the browser, never under the anon key) and moved into Supabase Vault — encrypted at rest — with only a pointer kept in the application table. A plaintext fallback exists solely so older rows keep working until migrated.",
  },
  {
    h: "6. Email sending",
    b: "Reminders go out through Resend from our own verified domain (reminders@getoverdue.online) with your address on Reply-To — we never spoof your domain. SPF, DKIM and DMARC are configured; bounces and complaints automatically stop the ladder.",
  },
  {
    h: "7. Webhooks are signed",
    b: "Every inbound webhook (Paddle, Resend, Stripe, PayPal, Xero, reply detection, cron dispatch) is verified by HMAC signature or shared secret before anything happens. Unsigned or replayed requests are rejected with 401, and processed events are deduplicated in an idempotency ledger.",
  },
  {
    h: "8. AI drafting",
    b: "When enabled, only the current invoice, client name, and ladder step are sent to the language model to draft that one message. Client lists are never bulk-uploaded, and message content is never used to train models.",
  },
  {
    h: "9. Payments",
    b: "Paddle is our merchant of record: card numbers, tax handling and refunds run through Paddle, never our servers. We store only your plan, status and subscription ids.",
  },
  {
    h: "10. Retention & deletion",
    b: "Delete your account from Settings at any time: your user row cascades to clients, invoices, ladders, runs and messages, and connected tokens are revoked client-side. Backups expire on the provider's normal rotation. Email us at hello@getoverdue.online for export or deletion help — we respond within 30 days.",
  },
  {
    h: "11. What we don't claim",
    b: "We are not SOC 2, ISO 27001 or HIPAA certified. Overdue is built for freelance and agency receivables — not medical, legal-trust, or other regulated data. If you need a signed DPA, contact us before subscribing.",
  },
  {
    h: "12. Report a vulnerability",
    b: "Found something? Email hello@getoverdue.online with 'security' in the subject, include steps to reproduce, and give us a reasonable window to fix before disclosing. We credit reporters who help us protect users.",
  },
]

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-hairline bg-paper/90">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-5">
          <Wordmark />
          <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted hover:text-ink">Back home</Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-14">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-moss">Trust</div>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-ink">Security at Overdue</h1>
        <p className="mt-4 max-w-measure text-[15px] leading-relaxed text-ink-soft">
          You trust us with your receivables — who owes you, how much, and what you said
          to them. Here is exactly how that data is handled. Plain language, no badges
          we haven&apos;t earned.
        </p>
        <div className="mt-10 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="font-display text-xl text-ink">{s.h}</h2>
              <p className="mt-2 max-w-measure text-[14px] leading-relaxed text-ink-soft">{s.b}</p>
            </section>
          ))}
        </div>
        <p className="mt-10 border-t border-hairline pt-6 text-sm text-muted">
          Also see the <Link href="/privacy" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">Privacy policy</Link> and{" "}
          <Link href="/terms" className="text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">Terms of Service</Link>.
        </p>
      </main>
    </div>
  )
}
