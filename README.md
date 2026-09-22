# Overdue · The Ledger

Invoice follow-up automation with an escalation ladder: gentle day 1 → nudge day 7 →
firm day 14 → final day 21. Built for freelancers and small agencies.

**Design language:** "The Ledger" — paper-warm neutrals, Fraunces serif display, IBM Plex
Mono for money, and a semantic color temperature ramp for overdue urgency. Editorial and
warm, not SaaS-y. Conviction about what the product does; absolute honesty about what it
doesn't ("an expectation, not a promise", "no client email — reminders can't be sent"). No
ROI marketing claims, no invented delivery evidence.

## Stack

- Next.js 16.3.5 (App Router, TypeScript) + Tailwind · React 19.3.0 · Vitest 5 · ESLint 9
- Supabase (Postgres + Auth + RLS) — `supabase/migrations/`
- Paddle (PRIMARY merchant of record) with Dodo Payments as a DISABLED fallback
- Resend (email delivery + inbound replies) · Svix/legacy/Bearer webhook signatures
- LLM drafting via any OpenAI-compatible endpoint (OpenAI / Groq / third fallback)
- Upstash Redis rate limiting · Sentry (wired, inert until DSNs set) · Vercel Cron

## Quickstart

```bash
cp .env.example .env.local   # fill in values (see below)
npm install
npm run dev
```

- Rotate any key if `.env.example` ever ships with values — it is meant to be blank.
- Run migrations in order: `0001_init.sql` → `0020_maint_assert_write_boundary.sql`.
- Enable **Email (password)** auth provider → `users` + `profiles` + `subscriptions` +
  the default ladder are auto-created by `on_auth_user_created` triggers.
- Env keys are documented inline in `.env.example` (Supabase, App, Paddle, Dodo,
  Resend, LLM, Stripe, PayPal, Xero, Upstash, Sentry, CRON, inbound webhook).

---

# Project Status — Done · Pending · To Do

## ✅ Done (with evidence)

### Hardening / security (A1–A9 in this pass)
- **Tenant ownership guard** — `src/lib/supabase/ownership.ts` + test
  (`getOwnedRecord`, `assertOwnsResource`); `invoices/[id]` PATCH and `sequences`
  PUT/DELETE refactored onto it.
- **Write-boundary enforcement** — migration `0020_maint_assert_write_boundary.sql`
  adds `public.assert_write_boundary()` (SECURITY DEFINER, service_role-only) asserted
  by `scripts/assert-write-boundary.mjs` over REST. **APPLIED TO LIVE — verified
  `0 problems` on 2026-09-22 (live-20260922T174224Z.log).**
- **RLS / API boundary** — `0019_api_write_boundary.sql` **APPLIED TO LIVE**: drops the
  FOR-ALL/insert ownership policies on `profiles/integrations/clients/invoices/sequences/
  runs/messages/reply_intel/disputes/settlement_offers/settlement_events/
  payment_plan_requests`; revokes anon/authenticated writes; keeps owner reads.
- **Hardening fixes** — `0018_hardening_fixes.sql` **APPLIED TO LIVE**: D13 subs policy
  lockdown, D15 single-subscription dedupe + `subscriptions_user_uidx`, D08 one-active-run
  partial index, D02 offer `delivered_at`/`viewed_at`, D10 `messages.status` write-ahead + a
  `5` indexes, D24 `payment_plan_requests` table + RLS, D09 ladder `[1,6,7,7]` repair.
- **A9 fail-closed dispatch** — `runDispatcher` returns `{ok:false,error:"missing
  SUPABASE_SERVICE_ROLE_KEY — refusing to dispatch"}` instead of fail-open; cron route
  returns **500** on `!report.ok`.
- **A6 async rate limiting** — `src/lib/utils/rate-limit.ts` wraps Upstash Redis sliding
  window with an in-memory fallback; `resetMs` from `res.reset` (no more clock confusion).
- **E2E specs** — `e2e/public-routes.spec.ts`, `e2e/security-boundary.spec.ts`,
  `e2e/authed.spec.ts` (+ `e2e/env.ts`); credential-gated ones skip cleanly offline.
- **Sentry wired** — `src/instrumentation.ts`, `src/instrumentation-client.ts`,
  `src/sentry.server.config.ts`, `src/sentry.edge.config.ts`, `withSentryConfig` in
  `next.config.mjs`, CSP `connect-src` updated. Inert while DSNs are empty.

### UX/product pass (shipped, code-verified)
- Resumable 5-step onboarding wizard (persisted to `localStorage`), exact-email preview,
  exists only after `onboarding_completed` write.
- Per-invoice recovery timeline (`buildInvoiceTimeline`, pure + 7 tests), invoice detail
  route `/invoices/[invoiceId]` with `#settlement` anchor + `?focus=` deep links.
- Dashboard first-invoice card (three pathways), dynamic header CTA, honest Free notes.
- Mobile labeled dock + desktop topbar nav; ledger row "⋯" action sheet with
  `confirm()` on destructive actions; paused state survives reload from server.
- Google OAuth completion preserves its PKCE/browser context, uses the session
  returned by the code exchange directly, and never mislabels a Google failure
  as an email-confirmation-link error.
- Manual invoice: currency select (`CURRENCIES`), existing-client picker, no-email draft,
  duplicate-submit guard.
- Settlement: percent input + `est.` EV labels + "keep the full amount and wait" baseline.
- Exact-email confirmation: manual send previews the real server-generated subject/body,
  sender, recipient, ladder rung and resolve action; a short-lived signed token binds the
  confirmation to that exact draft. Manual send atomically claims the run to prevent a
  click/cron race and never reports a paused/disputed run as sent.
- Editable sender name now controls both the visible email From name (`Name via Overdue`)
  and the signature while retaining the deployment's verified delivery address.
- Invoice-source dialog: PayPal, Xero and CSV stay in-context; QuickBooks is visible but
  disabled as **Coming soon** for the post-launch Intuit integration.
- Billing: Paddle checkout by default, Dodo checkout only behind the explicit
  `DODO_FALLBACK_ENABLED=true` flag, real quotas from
  `src/lib/billing/limits.ts`, no dead `ready&&ready`, no unbacked ROI claims.
- Multi-currency reporting: dashboard aging totals, Insights aging/DSO, cash forecasts
  and fast-cash lines are calculated and displayed independently per currency.

### Defect register (D01–D42) — every described defect fixed on HEAD
| Severity | Fixed | Open |
|----------|-------|------|
| Cri | D13, D33, D38 | — |
| Hi | D01, D05, D06, D07, D08, D09, D14, D15, D25, D34, D35, D36, D37, D39 | — |
| Med | D02, D03, D04, D10, D11, D12, D16, D17, D18, D19, D20, D24, D29, D31 | — |
| Low | D27, D30, D32, D40, D41, D42 | — |
| —    | — | None among the 37 defects that had a description and reproduction |

Key fixes in the master pass (D29–D32): paid webhooks record real provider amounts and
drive the shared `reconcilePaidWork` (`src/lib/recovery/paid.ts`) returning 500 on
DB-write failure so providers retry; settlement card clipboard/expiry honesty; client
email validation; AI prompt-injection hardening.

Historical IDs D21/D22/D23/D26/D28 were empty placeholders in the deleted audit files:
they had no area, severity, reproduction or expected behavior. They are not counted as
closed defects and are not represented as release evidence. Any recovered source finding
must be added back with a reproducible description and its own test.

### Gates (test evidence — last recorded 2026-09-22)
| Gate | Command | Result |
|------|---------|--------|
| G2 unit suite | `npm test` | **229 passed, 0 failed (31 files)** |
| G3 typecheck | `npx tsc --noEmit` | passed (exit 0) |
| G4 production build | `npm run build` | green (all routes compiled, templates prerendered) |
| G12 dependency security | `npm audit` | **0 vulnerabilities** |
| Lint | `npm run lint` | passed |
| G5 live migrations | `bash scripts/verify-gates.sh live` | **PASS — write-boundary + migration state verified `0 problems` (live)** |

### Environment
- Node v22.23.1 · Vitest v5.0.1 · `npm ci` (585 packages, 0 vulnerabilities).

---

## ⏳ Pending / To Do

### Live-lane (needs real creds/services — user executes)
- **G6 — live authenticated E2E / negative boundary tests** against the staging project that
  has 0018+0019+0020 applied: run `e2e/security-boundary.spec.ts` + `e2e/authed.spec.ts`
  with `E2E_EMAIL`/`E2E_PASSWORD` set.
- **G7 — live provider smoke**: Paddle checkout → webhook → entitlement flip; Resend
  outbound/inbound reply → ladder pause; Svix signature verification. Exercise Dodo only
  if `DODO_FALLBACK_ENABLED=true`. No live provider transaction has been run.
- **G8 — cron**: confirm `DISPATCH_URL` + `CRON_SECRET` repo secrets + a green
  `workflow_dispatch` run returning 200 with `{"ok":true,...}` and a report parse.
- **Live env wiring**: `UPSTASH_REDIS_REST_URL/TOKEN`, real Sentry DSNs, real Paddle
  price IDs (`pro_...` → `pri_...`, incl. an annual price for D4.1), and Vercel connect/SHA.
- **Data repair pre-G5** (only if a dev DB already had tenants) — see Runbook below;
  live had no pre-existing tenants.

### Agent-lane
- Verify gates again on the exact commit promoted, and record output.

### Open decisions (fixes needing a yes/no from the owner)
- **Sentry now** (free tier) vs Vercel-logs-first — wiring is done; ship or keep DSNs empty.
- **QuickBooks provider** — intentionally deferred until after launch; UI is disabled and
  labeled Coming soon, with no misleading OAuth/connect action.
- **Team seats** (D4.4 design-first, hinges on `assertOwnsResource`) remains in scope —
  confirm scope.
- **G5/G7 lane split** (agent writes code, owner runs live/charged steps, staging-first) —
  confirm standing policy.

---

## Roadmap

### P1 — designed, next
- Plain-language "why did the ladder pause?" (`promise_note`/`reply_classification`).
- Settlement offer card status on the detail page.
- `/tools` landing refresh to match ledger voice.

### P2 — future
- Industry template editorial variants (auto workshops, agencies, trades) on top of the
  existing 12 template pages.
- Email open/delivery instrumentation per message (only where the provider truly confirms).
- First-login → first-recovery cohort funnel in product analytics.

### D4 feature group (planned)
- D4.1 Paddle annual price · D4.2 multi-currency · D4.3 (TBD) · D4.4 team seats (design-first).

---

# Reference

## Workflow map (W1–W7) — how the product actually runs

- **W1 Invoice ingestion** — manual (`POST /api/invoices`), CSV
  (`/api/integrations/csv`, RFC-4180, row-level errors, quota-blocked clients skip, no
  orphans), provider sync (`src/lib/integrations/sync.ts`, idempotent upsert keyed
  `(user_id, provider, provider_id)`). Invoice: `pending → sent → overdue → partially_paid → paid` (paid absorbing).
- **W2 Escalation ladder** — cron (`/api/cron/dispatch`, `CRON_SECRET`) or user action →
  `runDispatcher`: `requeueStaleProcessing()` first (D11) → pick due `queued` runs → plan
  resolved once per batch (`planForSubscription`, D14) → `dispatchOne` reloads steps fresh,
  embeds settlement "Resolve for X" button, neutralises paid, gates on open dispute /
  pending plan request, write-ahead `messages` `sending`→`sent`/`failed` (D10), advances by
  cumulative days (D09). Inbound replies match thread-first (`In-Reply-To`/`References`)
  then address. Run: `queued ⇄ processing → sent → queued… | paused ↔ queued | completed | failed`.
- **W2a Manual confirmation** — `POST /api/invoices/[id]/send/preview` composes the real
  current rung once and signs its subject/body/run/step/offer for ten minutes. The owner
  sees the exact draft and explicitly confirms it; `/send` verifies the token, atomically
  claims the run, attaches only the reviewed resolve offer, and then calls Resend.
- **W3 Billing / entitlement** — ONE `subscriptions` row per user (`onConflict:'user_id'`,
  D15); `entitlement.ts` is the ONLY place "is pro?" is decided; grace through
  `current_period_end`; unknown product + no prior grant = **free**.
- **W4 Paid detection & reconciliation** — Stripe/PayPal/Xero webhooks + manual
  `mark_paid` all funnel through `reconcilePaidWork`: invoice → paid, runs → cancelled,
  disputes → resolved, offers → paid + event. 500 on write failure (D29) so providers retry.
- **W5 Smart Settlement** — `/api/settlements/recommend` (read-only) →
  `/api/settlements/approve` (offers `<= outstanding`, `>= minAcceptable`, incentive ≤ 2000
  bps, `fee_waiver` needs `feeBasisConfirmed`; supersedes prior live offer; link capped 14
  days). Offer: `approved → sent → accepted → paid | cancelled | expired`. Debtor side:
  view = `viewed_at` only; accept = commitment; dispute → pause; plan_request → row + pause;
  pay → discounted link or 409.
- **W6 Account lifecycle** — export streams every owned table (profiles by PK `id`); delete
  cancels BOTH Paddle and Dodo; configured-provider cancel failure blocks deletion.
- **W7 Tools & marketing** — smart-csv map→insights; 12 SEO template pages; middleware
  canonical-host 307 + Supabase cookie refresh; CSP/HSTS via `next.config.mjs`.

## Runbook — data repair before G5 apply (scripts/tenant-precheck.sql companion)

> Rule of thumb: fix by **keeping the row that represents reality**; back up first
> (`\copy (select ...) to 'backup.csv' csv`). Used with `psql "$DATABASE_URL"` (live ref
> `zuctxglrrijcvtcwckks` or staging).

1. **Seeded ladders on `[1,7,7,7]`** — no action; 0018 normalises `[1,6,7,7]`. Off-grid
   user ladders are never touched.
2. **Duplicate subscriptions** — 0018 dedupes (paddle > dodo > pro > newest). Manual
   alternative keeps the most senior row, archives the rest (see archived SQL below).
3. **Two active runs per invoice — MUST fix before 0018** (index is skipped otherwise):
   retire the weaker run → `status='failed', error='deduped pre-0018 by runbook'`.
   Prefer keeping the furthest-along run.
4. **Orphaned runs / write-ahead leftovers** — self-heal via `dispatchOne` attempt cap;
   tidy by failing runs missing their sequence/invoice.
5. **Expired offers still `approved`/`sent`** — cosmetic; expire explicitly if tidy.
6. **Invalid currency** — normalise to uppercase ISO-4217.
7. **Stuck `processing` > 5 min** — auto-healed by `requeueStaleProcessing`; no action.

### Manual subscription dedupe (if you want to control it)
```sql
begin;
create table if not exists _subs_archive as select * from public.subscriptions where false;
with ranked as (
  select id, row_number() over (
    partition by user_id
    order by (billing_provider='paddle' and paddle_subscription_id is not null) desc,
             (billing_provider='dodo'    and dodo_subscription_id    is not null) desc,
             (plan='pro') desc, created_at desc, id
  ) as rn from public.subscriptions)
insert into _subs_archive select s.* from public.subscriptions s
  join ranked r on r.id = s.id and r.rn > 1;
delete from public.subscriptions s using ranked r where s.id = r.id and r.rn > 1;
commit;  -- verify, then: drop table _subs_archive;
```

### Apply + verify
```bash
supabase db push            # applies forward migrations to the linked live project
bash scripts/verify-gates.sh live     # → scripts/assert-write-boundary.mjs (REST, service role)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tenant-precheck.sql
```

### Rollback drill (A7)
`DATABASE_URL=postgres://... bash scripts/sql-rollback-drill.sh [--force]` replays
`0019_down.sql` → `0018_down.sql` → forward re-apply on a **non-live** DB and asserts the
rollback artifacts are gone, then restored. Refuses the production project ref without
`--force`. The `_down` files live in `scripts/rollback/`, forward files in
`supabase/migrations/`.

## Security / ops caveats that are intentional (review before launch)
- Paid webhooks ack only succeeded writes (D29) — a failed DB flip returns 500, provider retries.
- `settlement_events` has no unique constraint → `viewed` can double-log on retry (analytical only).
- Active-run index is best-effort on dirty DBs (dupes → index skipped; dedupe first at G5).
- One subscription row per user — a simultaneous Paddle+Dodo upgrade is an accepted edge case.
- Provider "not configured" during delete → warn + proceed; configured-but-failing cancel blocks.
- Sync is user-triggered; upserts idempotent; residual race is a rare cross-instance token
  refresh that self-heals. Wrap in a DB lease if hourly cross-provider sync is ever added.
- Ladder edits don't reset run progress (steps re-read fresh per send) — intentional.

## Test inventory (229 in 31 files)
Suites cover: ownership (`ownership.test.ts`), billing events rewrite (upsert-on-`user_id`),
entitlement (11), settlement EV (8), thread IDs (3), paid-webhooks (17), dispatch (11),
onboarding schedule (9) + timeline (7), csv, format, token, send, queries, smart-csv, and
the pre-existing analysis/auth suites. Run: `npm test`.

## File layout (condensed)
- `supabase/migrations/` — 20 forward migrations (0001→0020); `_down.sql` rollbacks in `scripts/rollback/`.
- `src/app/api/` — server routes (account, ai, billing, clients, cron, health,
  integrations, invoices, r/[token], sequences, settlements, tools, webhooks).
- `src/app/(app)/` — dashboard, invoices, clients, sequences, settings, tools, insights.
- `src/components/` — app-shell, auth, billing, calculators, ledger, marketing, settings,
  settlements, tools, ui primitives.
- `src/lib/` — ai, analysis, auth, billing, csv, db, dodo, integrations, paddle, recovery,
  resend, scheduler, seo, supabase, utils, webhooks.
- `src/middleware.ts` — canonical-host 307 + session refresh (never bounces API/auth).
- `scripts/` — verify-gates.sh, assert-write-boundary.mjs, tenant-precheck.sql,
  sql-rollback-drill.sh, rollback/ (*_down.sql), dodo-e2e.sh, launch-check.sh.
- `e2e/` — Playwright specs (public-routes, security-boundary, authed) + env.ts.
- `.github/workflows/dispatch.yml` — hourly cron → `/api/cron/dispatch`, fails on non-200/`ok:false`.
