import Link from "next/link"
import { siteUrl } from "@/lib/site-url"

export function Breadcrumbs({ items }: { items: { label: string; href: string }[] }) {
  const base = siteUrl()
  const list = [{ label: "Home", href: "/" }, ...items]
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: list.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: `${base}${item.href}`,
    })),
  }

  return (
    <>
      <nav aria-label="Breadcrumb" className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {list.map((item, index) => (
            <li key={item.href} className="flex items-center gap-x-2">
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {index === list.length - 1 ? <span className="text-ink-soft">{item.label}</span> : <Link href={item.href} className="hover:text-ink">{item.label}</Link>}
            </li>
          ))}
        </ol>
      </nav>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  )
}
