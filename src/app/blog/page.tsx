import Link from "next/link"
import { Metadata } from "next"
import { MarketingNav, MarketingFooter } from "@/components/marketing/site"
import { BLOG_POSTS } from "@/lib/seo/blog-posts"
import { Breadcrumbs } from "@/components/marketing/breadcrumbs"

export const metadata: Metadata = {
  title: "Overdue Invoices Blog - Tips, Templates & Guides",
  description:
    "Learn how to handle overdue invoices, write effective reminder emails, and automate collections. Get templates, calculators, and actionable advice.",
  keywords: [
    "overdue invoices blog",
    "invoice overdue tips",
    "overdue invoice collection guides",
    "invoice reminder templates",
  ],
  alternates: { canonical: "/blog" },
}

export default function BlogPage() {
  const posts = BLOG_POSTS.sort((a, b) => a.title.localeCompare(b.title))
  return (
    <div className="min-h-screen bg-paper">
      <MarketingNav />
      <main className="mx-auto max-w-5xl px-5 py-14">
        <Breadcrumbs items={[{ label: "Blog", href: "/blog" }]} />
        <h1 className="mt-4 font-display text-4xl tracking-tight text-ink sm:text-5xl">
          Overdue Invoices Blog
        </h1>
        <p className="mt-4 max-w-measure text-[15px] leading-relaxed text-ink-soft">
          Practical guides, templates, and tips for managing overdue invoices, collecting late payments, and improving cash flow.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col rounded-xl border border-hairline bg-surface p-6 shadow-ledger transition-all duration-150 hover:-translate-y-0.5 hover:border-moss focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-moss"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-moss">{post.category}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                  {post.readTime} min read
                </span>
              </div>
              <h2 className="mt-3 font-display text-xl tracking-tight text-ink group-hover:text-moss-bright">
                {post.title}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{post.intro}</p>
            </Link>
          ))}
        </div>
      </main>
      <MarketingFooter />
    </div>
  )
}
