import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Wordmark } from "@/components/marketing/site"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-5 text-center">
      <Wordmark />
      <h1 className="mt-6 font-display text-6xl tracking-tight text-ink">404</h1>
      <p className="mt-2 max-w-sm font-mono text-[13px] leading-relaxed text-muted">
        This page isn't on the ledger. Probably a typo, or someone already collected it.
      </p>
      <div className="mt-6">
        <Link href="/">
          <Button>Back to the ledger</Button>
        </Link>
      </div>
    </div>
  )
}