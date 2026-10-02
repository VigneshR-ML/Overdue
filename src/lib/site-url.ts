/**
 * Single source of truth for the app's canonical origin.
 *
 * This used to be duplicated as a literal in five modules with three different
 * fallbacks: four said `https://www.getoverdue.online` and the sitemap said
 * `http://localhost:3000`. That is a real hazard rather than cosmetic, because
 * `proxy.ts` treats NEXT_PUBLIC_APP_URL as canonical and redirects every other
 * host to it — so a `www` fallback would have bounced production traffic from
 * `getoverdue.online` onto `www.`, and a missing env var would have published
 * localhost URLs in the sitemap.
 *
 * The apex domain is canonical: the proxy already redirects `www.*` and preview
 * hosts to it, which is also what the Supabase redirect allowlist and the legal
 * pages assume. Keep it that way when editing.
 */

const CANONICAL_ORIGIN = "https://getoverdue.online"

/** Canonical origin, no trailing slash. Never returns an empty string. */
export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) {
    try {
      const url = new URL(configured)
      if (url.protocol === "http:" || url.protocol === "https:") return url.origin
    } catch {
      // A malformed deployment variable must not leak into canonical tags or the sitemap.
    }
  }
  // Unconfigured local dev still points at the dev server; an unconfigured
  // production deploy falls back to the real domain rather than localhost.
  return process.env.NODE_ENV === "development" ? "http://localhost:3000" : CANONICAL_ORIGIN
}

/** Canonical hostname (no protocol, no path) for host-comparison middleware. */
export function canonicalHost(): string {
  return new URL(siteUrl()).host
}
