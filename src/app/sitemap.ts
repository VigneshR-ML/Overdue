import type { MetadataRoute } from "next"
import { EMAIL_TEMPLATES } from "@/lib/seo/email-templates"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.getoverdue.online"
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1, lastModified: now },
    { url: `${base}/signup`, changeFrequency: "monthly", priority: 0.7, lastModified: now },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.6, lastModified: now },
    { url: `${base}/security`, changeFrequency: "monthly", priority: 0.5, lastModified: now },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2, lastModified: now },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2, lastModified: now },
    { url: `${base}/refund`, changeFrequency: "yearly", priority: 0.2, lastModified: now },
    { url: `${base}/templates`, changeFrequency: "weekly", priority: 0.8, lastModified: now },
    { url: `${base}/usd-invoice-follow-up`, changeFrequency: "monthly", priority: 0.8, lastModified: now },
    { url: `${base}/for-freelancers`, changeFrequency: "monthly", priority: 0.85, lastModified: now },
    { url: `${base}/for-agencies`, changeFrequency: "monthly", priority: 0.85, lastModified: now },
    { url: `${base}/invoice-follow-up-software`, changeFrequency: "monthly", priority: 0.85, lastModified: now },
    { url: `${base}/payment-reminder-software`, changeFrequency: "monthly", priority: 0.85, lastModified: now },
  ]

  const templates: MetadataRoute.Sitemap = EMAIL_TEMPLATES.map((t) => ({
    url: `${base}/templates/${t.slug}`,
    changeFrequency: "monthly",
    priority: 0.7,
    lastModified: now,
  }))

  return [...staticRoutes, ...templates]
}
