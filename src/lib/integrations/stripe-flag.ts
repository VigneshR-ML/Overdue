/**
 * Stripe availability flag — Stripe is not available in India as of now.
 *
 * UI hides every Stripe reference while this is false; the sync + webhook
 * code stays intact so re-enabling later is a one-line change:
 *   NEXT_PUBLIC_STRIPE_ENABLED=true
 * ...plus restoring STRIPE_CLIENT_ID / STRIPE_CLIENT_SECRET.
 */
export const STRIPE_ENABLED = process.env.NEXT_PUBLIC_STRIPE_ENABLED === "true"
