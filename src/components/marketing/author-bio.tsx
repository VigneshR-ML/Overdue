import Link from "next/link"

export function AuthorBio() {
  return (
    <aside aria-label="About the author" className="rounded-lg border border-hairline bg-surface p-5 shadow-ledger">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Published by</p>
      <h2 className="mt-2 font-display text-xl text-ink">The Overdue editorial team</h2>
      <p className="mt-2 max-w-measure text-sm leading-relaxed text-muted">
        We publish practical invoice follow-up resources based on the workflow we build and maintain. Product details are reviewed before publication.
      </p>
      <Link href="/about" className="mt-3 inline-block text-sm font-medium text-ink underline decoration-hairline underline-offset-2 hover:decoration-moss">
        About Overdue
      </Link>
    </aside>
  )
}
