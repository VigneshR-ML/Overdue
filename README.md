# Overdue · The Ledger

Invoice follow-up automation with an escalation ladder: gentle day 1 → nudge day 7 →
firm day 14 → final day 21. Built for freelancers and small agencies.

**Design language:** "The Ledger" — paper-warm neutrals, Fraunces serif display, IBM Plex
Mono for money, and a semantic color temperature ramp for overdue urgency.

## Stack

- Next.js 14 (App Router, TypeScript) + Tailwind
- Supabase (Postgres + Auth + RLS) — `supabase/migrations/`
- Paddle Billing (merchant of record — works worldwide including solo founders in India)
- Resend (email delivery + tracking)
- LLM drafting via any OpenAI-compatible endpoint
- Vercel Cron for the dispatch engine

## Quickstart

```bash
cp .env.example .env.local   # fill in values (see below)
npm install
npm run dev
```

### Supabase
1. Create a project, copy `Project URL` + `anon public` + `service_role` into `.env.local`.
   **Rotate the keys if `.env.example` ever shipped with values** — it is meant to be blank.
2. Run the migrations in order: `0001_init.sql`, `0002_credentials.sql`, `0003_vault_credentials.sql`,
   `0004_dispatch_states.sql`.
3. Enable **Email (password)** auth provider → users + `profiles` + `subscriptions` +
   the default ladder are auto-created by the `on_auth_user_created` triggers.

### Ops checklist before launch
- [ ] `.env.local` — all keys (see `.env.example`)
- [ ] `APP_ENV=production` on the live deploy (NOT `NODE_ENV`)
- [ ] Paddle sandbox: vendor id + price ID → test checkout via `/settings/billing`
- [ ] Paddle webhook → `https://<your-app>.vercel.app/api/webhooks/paddle` (`PADDLE_WEBHOOK_SECRET`)
- [ ] Resend: verify domain, point `RESEND_FROM_EMAIL`, webhook → `/api/webhooks/resend`
      (`RESEND_WEBHOOK_SECRET`)
- [ ] Inbound reply webhook → `/api/webhooks/email` with `INBOUND_WEBHOOK_SECRET` (Svix-signed or Bearer)
- [ ] `CRON_SECRET` + GitHub Actions hourly dispatch (`.github/workflows/dispatch.yml`
      needs `DISPATCH_URL` + `CRON_SECRET` repo secrets) → authorized hourly POST to
      `/api/cron/dispatch`. `vercel.json` crons are intentionally empty (hourly Vercel
      Cron needs Pro).
- [ ] Migrate `integration_credentials` plaintext rows to Vault via `0003_vault_credentials.sql`
      (app auto-falls back to Vault when available, plaintext otherwise)

### Key flows
- **Sync:** `/api/integrations/*` pull invoices → upsert `clients`/`invoices` → `attachDefaultRuns`.
- **Dispatch:** cron → `runDispatcher()` claims due runs atomically, drafts (local template
  render → optional LLM refinement), sends via Resend, re-schedules the next rung.
- **Stop conditions:** invoice paid (any source/webhook), client replied (inbound webhook),
  ladder deactivated.
- **Billing:** Paddle checkout overlay (client) + signed webhook (server) keeps `subscriptions`
  current. **Plan gating is enforced:** Free = 1 client / 1 ladder / no automated sync; Pro unlocks
  unlimited clients, ladders and Stripe/PayPal/Xero sync (`src/lib/billing/plan.ts`).

## Costs @ launch volume
Paddle 5%+$0.50 · Vercel/Supabase $0 tiers · Resend ≤3k/mo free · LLM ~$5–20/mo ⇒ ~$15–30/mo.

## Notes
- `integration_credentials` uses Supabase Vault when available (`0003` migration), falling back to a
  server-only, RLS-off table otherwise. Values are never exposed to the anon key.
- `runs.status` includes `processing` (`0004` migration) for atomic dispatch claiming; failed sends
  back off and retry up to 5 attempts before failing.
- `OverdueBadge` temperature = real business logic (escalation ramp), not decoration.