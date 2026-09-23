import type { MetadataRoute } from "next"
import { EMAIL_TEMPLATES } from "@/lib/seo/email-templates"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.getoverdue.online").replace(/\/$/, "")

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/security`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/refund`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/templates`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/usd-invoice-follow-up`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/for-freelancers`, changeFrequency: "monthly", priority: 0.85 },
    { url: `${base}/for-agencies`, changeFrequency: "monthly", priority: 0.85 },
    { url: `${base}/invoice-follow-up-software`, changeFrequency: "monthly", priority: 0.85 },
    { url: `${base}/payment-reminder-software`, changeFrequency: "monthly", priority: 0.85 },
  ]

  const templates: MetadataRoute.Sitemap = EMAIL_TEMPLATES.map((t) => ({
    url: `${base}/templates/${t.slug}`,
    changeFrequency: "monthly",
    priority: 0.7,
  }))

  return [...staticRoutes, ...templates]
}
