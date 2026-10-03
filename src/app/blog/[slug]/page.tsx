import Link from "next/link"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import { MarketingNav, MarketingFooter } from "@/components/marketing/site"
import { BLOG_POSTS, getBlogPostBySlug } from "@/lib/seo/blog-posts"
import { Button } from "@/components/ui/button"
import { Breadcrumbs } from "@/components/marketing/breadcrumbs"
import { AuthorBio } from "@/components/marketing/author-bio"

export const dynamicParams = true

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }))
}

function inline(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(
      /(https:\/\/[^\s)]+)/g,
      '<a href="$1">$1</a>',
    )
}

function renderPostBody(content: string): string {
  return content
    .split("\n\n")
    .map((para) => {
      if (para.startsWith("## ")) {
        return `<h2>${inline(para.replace("## ", ""))}</h2>`
      }
      if (/^(\d+\.\s)/m.test(para)) {
        return `<ol>${para
          .split("\n")
          .map((line) => `<li>${inline(line.replace(/^\d+\.\s*/, ""))}</li>`)
          .join("")}</ol>`
      }
      if (para.startsWith("- ")) {
        return `<ul>${para
          .split("\n")
          .map((line) => `<li>${inline(line.replace(/^-\s*/, ""))}</li>`)
          .join("")}</ul>`
      }
      return `<p>${inline(para).replace(/\n/g, "<br/>")}</p>`
    })
    .join("")
}

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const post = getBlogPostBySlug(params.slug)
  if (!post) return { title: "Blog post not found" }
  return {
    title: post.metaTitle,
    description: post.metaDescription,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${post.slug}` },
  }
}

export default async function BlogPostPage(props: Props) {
  const params = await props.params
  const post = getBlogPostBySlug(params.slug)
  if (!post) notFound()

  const related = BLOG_POSTS.filter((p) => p.slug !== post.slug && p.category === post.category)
    .slice(0, 3)

  return (
    <div className="min-h-screen bg-paper">
      <MarketingNav />
      <main className="mx-auto max-w-3xl px-5 py-14">
        <Breadcrumbs
          items={[
            { label: "Blog", href: "/blog" },
            { label: post.title, href: `/blog/${post.slug}` },
          ]}
        />
        <div className="mt-4 flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-moss">{post.category}</span>
          <span className="text-faint">•</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
            {post.readTime} min read
          </span>
        </div>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">{post.title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">{post.intro}</p>

        <article className="prose prose-neutral mt-10 max-w-none prose-headings:font-display prose-headings:tracking-tight prose-p:text-ink-soft prose-li:text-ink-soft prose-a:text-moss">
          <div
            dangerouslySetInnerHTML={{
              __html: renderPostBody(post.content),
            }}
          />
        </article>

        <div className="mt-12 rounded-lg border border-hairline bg-surface p-6 shadow-ledger">
          <h2 className="font-display text-2xl text-ink">Automate your overdue invoice follow-ups</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            Stop chasing overdue invoices manually. Overdue automates the entire follow-up ladder with polite to final reminders that pause when clients reply or pay.
          </p>
          <div className="mt-5">
            <Link href="/signup">
              <Button variant="moss">Use GetOverdue for free 14 days trial</Button>
            </Link>
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-10">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">Related posts</div>
            <div className="mt-3 space-y-2">
              {related.map((r) => (
                <Link key={r.slug} href={`/blog/${r.slug}`} className="block text-moss hover:underline">
                  {r.title}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8">
          <AuthorBio />
        </div>
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description: post.metaDescription,
            author: { "@type": "Organization", name: "Overdue" },
            publisher: { "@type": "Organization", name: "Overdue", logo: { "@type": "ImageObject", url: "https://getoverdue.online/icon.svg" } },
            mainEntityOfPage: { "@type": "WebPage", "@id": `https://getoverdue.online/blog/${post.slug}` },
          }).replace(/</g, "\\u003c"),
        }}
      />
      <MarketingFooter />
    </div>
  )
}
