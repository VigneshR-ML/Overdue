import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/site-url"

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl()
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private HTML routes send a noindex directive so crawlers can see it.
      // Disallow machine endpoints and auth-gated app routes so crawl budget
      // stays on marketing content (/, /blog, /calculators, /templates).
      disallow: [
        "/api/",
        "/dashboard/",
        "/invoices/",
        "/clients/",
        "/sequences/",
        "/insights/",
        "/settings/",
        "/tools/",
        "/onboarding/",
        "/auth/",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  }
}
