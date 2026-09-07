import Link from "next/link"
import { Button } from "@/components/ui/button"

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`group inline-flex items-center gap-2 ${className}`}>
      <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-moss">
        <svg width="13" height="13" viewBox="0 0 12 12" aria-hidden className="text-paper">
          <path
            d="M6 10V2M6 2 2.5 5M6 2l3.5 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="font-display text-lg leading-none tracking-tight text-ink">
        Overdue
      </span>
      <span className="ml-1 hidden rounded-full border border-hairline px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.14em] text-muted transition-colors group-hover:border-ink-soft sm:inline">
        the ledger
      </span>
    </Link>
  )
}

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-paper/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Wordmark />
        <nav className="hidden items-center gap-7 text-sm text-ink-soft md:flex">
          <Link className="transition-colors hover:text-ink" href="/#how">How it works</Link>
          <Link className="transition-colors hover:text-ink" href="/#ladder">The ladder</Link>
          <Link className="transition-colors hover:text-ink" href="/#pricing">Pricing</Link>
          <Link className="transition-colors hover:text-ink" href="/templates">Templates</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
          <Link href="/signup">
            <Button variant="ink" size="sm">Start free</Button>
          </Link>
        </div>
      </div>
    </header>
  )
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-hairline bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Wordmark />
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-muted">
              The escalation ladder for unpaid invoices. Built for people who'd rather get paid than lecture.
            </p>
          </div>
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">Product</div>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li><Link href="/#how" className="hover:text-ink">How it works</Link></li>
              <li><Link href="/#ladder" className="hover:text-ink">The ladder</Link></li>
              <li><Link href="/#pricing" className="hover:text-ink">Pricing</Link></li>
              <li><Link href="/login" className="hover:text-ink">Sign in</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">Templates</div>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li><Link href="/templates/late-invoice-email-template" className="hover:text-ink">Late invoice email</Link></li>
              <li><Link href="/templates/late-payment-reminder-email" className="hover:text-ink">Late payment reminder</Link></li>
              <li><Link href="/templates/final-invoice-email" className="hover:text-ink">Final notice</Link></li>
              <li><Link href="/templates" className="hover:text-ink">All templates</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">Company</div>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li><Link href="/privacy" className="hover:text-ink">Privacy</Link></li>
              <li><Link href="/terms" className="hover:text-ink">Terms</Link></li>
              <li><a className="hover:text-ink" href="mailto:hello@overdue.app">hello@overdue.app</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-1 border-t border-hairline pt-5 font-mono text-[11px] text-faint sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Overdue Labs · Paddle-powered payments everywhere</span>
          <span>Made for people who send invoices</span>
        </div>
      </div>
    </footer>
  )
}