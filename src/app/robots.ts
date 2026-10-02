import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/site-url"

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl()
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private HTML routes send a noindex directive so crawlers can see it.
      // Only machine endpoints are disallowed from crawling.
      disallow: ["/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
  }
}
