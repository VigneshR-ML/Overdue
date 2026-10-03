import type { MetadataRoute } from "next"
import { EMAIL_TEMPLATES } from "@/lib/seo/email-templates"
import { BLOG_POSTS } from "@/lib/seo/blog-posts"
import { TOOL_CALCULATORS } from "@/lib/seo/tool-calculators"
import { siteUrl } from "@/lib/site-url"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/payment-reminder-software`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/invoice-follow-up-software`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/usd-invoice-follow-up`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/templates`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/security`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/refund`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/recovery-score`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/partners`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.4 },
    ...(["agencies", "consultants", "msps", "freelancers"] as const).map((slug) => ({ url: `${base}/for/${slug}`, changeFrequency: "monthly" as const, priority: 0.7 })),
  ]

  const templates: MetadataRoute.Sitemap = EMAIL_TEMPLATES.map((t) => ({
    url: `${base}/templates/${t.slug}`,
    changeFrequency: "monthly",
    priority: 0.7,
  }))

  const blogPosts: MetadataRoute.Sitemap = [
    { url: `${base}/blog`, changeFrequency: "weekly", priority: 0.8 },
    ...BLOG_POSTS.map((p) => ({
      url: `${base}/blog/${p.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ]

  const tools: MetadataRoute.Sitemap = [
    { url: `${base}/calculators`, changeFrequency: "weekly", priority: 0.8 },
    ...TOOL_CALCULATORS.map((t) => ({
      url: `${base}/calculators/${t.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ]

  return [...staticRoutes, ...templates, ...blogPosts, ...tools]
}
