import type { MetadataRoute } from "next"
import { EMAIL_TEMPLATES } from "@/lib/seo/email-templates"
import { TOOL_CALCULATORS } from "@/lib/seo/tool-calculators"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1, lastModified: now },
    { url: `${base}/signup`, changeFrequency: "monthly", priority: 0.7, lastModified: now },
    { url: `${base}/templates`, changeFrequency: "weekly", priority: 0.8, lastModified: now },
    { url: `${base}/tools`, changeFrequency: "weekly", priority: 0.8, lastModified: now },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.6, lastModified: now },
    { url: `${base}/security`, changeFrequency: "monthly", priority: 0.5, lastModified: now },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2, lastModified: now },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2, lastModified: now },
    { url: `${base}/refund`, changeFrequency: "yearly", priority: 0.2, lastModified: now },
  ]

  const templates: MetadataRoute.Sitemap = EMAIL_TEMPLATES.map((t) => ({
    url: `${base}/templates/${t.slug}`,
    changeFrequency: "monthly",
    priority: 0.7,
    lastModified: now,
  }))

  const tools: MetadataRoute.Sitemap = TOOL_CALCULATORS.map((t) => ({
    url: `${base}/tools/${t.slug}`,
    changeFrequency: "monthly",
    priority: 0.7,
    lastModified: now,
  }))

  return [...staticRoutes, ...templates, ...tools]
}